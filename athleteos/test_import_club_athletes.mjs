#!/usr/bin/env node
// ============================================================
// AthleteOS — test_import_club_athletes.mjs
//
// Vérifie le RPC transactionnel import_club_athletes(jsonb) contre une
// instance Supabase réelle/local CI : autorisation head coach, club dérivé
// du JWT, validations et limites serveur, absence de demi-import, refus
// des doublons email, cohérence users/athletes, comptage du résultat et
// rattachement signup ultérieur sans doublon ni prise de compte inter-club.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";

function loadDotEnv(filePath) {
  let text;
  try { text = readFileSync(filePath, "utf8"); } catch { return; }
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/u, "");
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/u);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
  }
}
loadDotEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.API_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error(
    "Variables manquantes : VITE_SUPABASE_URL/API_URL, "
    + "VITE_SUPABASE_ANON_KEY/ANON_KEY et SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const RUN_ID = Date.now();
const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function insertOrThrow(table, row) {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw new Error(`seed ${table} : ${error.message}`);
  return data;
}

async function makeUser(email, password, clubId, role, name) {
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) throw new Error(`createUser ${email} : ${authError.message}`);

  const row = await insertOrThrow("users", {
    club_id: clubId,
    name,
    email,
    role,
    auth_uid: authData.user.id,
  });
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn ${email} : ${signInError.message}`);
  return { auth: authData.user, row, client };
}

async function athleteCount(clubId) {
  const { count, error } = await admin
    .from("athletes")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId);
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  let clubA;
  let clubB;
  const accounts = [];
  const password = `Import-Test-${RUN_ID}-Aa!`;

  try {
    clubA = await insertOrThrow("clubs", {
      name: `Import Test Club A ${RUN_ID}`,
      invite_code: crypto.randomBytes(6).toString("hex").slice(0, 8).toUpperCase(),
    });
    clubB = await insertOrThrow("clubs", {
      name: `Import Test Club B ${RUN_ID}`,
      invite_code: crypto.randomBytes(6).toString("hex").slice(0, 8).toUpperCase(),
    });

    const headA = await makeUser(
      `import-head-a-${RUN_ID}@example.invalid`, password, clubA.id, "head_coach", "Head A",
    );
    const coachA = await makeUser(
      `import-coach-a-${RUN_ID}@example.invalid`, password, clubA.id, "coach", "Coach A",
    );
    const athleteA = await makeUser(
      `import-athlete-a-${RUN_ID}@example.invalid`, password, clubA.id, "athlete", "Athlete A",
    );
    const headB = await makeUser(
      `import-head-b-${RUN_ID}@example.invalid`, password, clubB.id, "head_coach", "Head B",
    );
    accounts.push(headA, coachA, athleteA, headB);

    const existingAthlete = await insertOrThrow("athletes", {
      club_id: clubA.id,
      name: "Athlète existant intact",
      age: 22,
      user_id: athleteA.row.id,
    });

    const sampleRow = { name: "Tentative interdite", email: "", age: 20, secondaryDisciplines: [] };

    // ── Autorisation : head_coach uniquement, jamais anon ───────────────────
    for (const [label, client] of [["coach", coachA.client], ["athlète", athleteA.client]]) {
      const { error } = await client.rpc("import_club_athletes", { p_rows: [sampleRow] });
      record(`import refusé pour ${label}`, Boolean(error), error ? "refusé, OK" : "AUTORISÉ !");
    }
    {
      const anon = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await anon.rpc("import_club_athletes", { p_rows: [sampleRow] });
      record("import refusé pour anon", Boolean(error), error ? "refusé, OK" : "AUTORISÉ !");
    }

    // ── Limites et validations serveur ─────────────────────────────────────────────
    const invalidPayloads = [
      ["payload non tableau", { name: "Objet isolé" }],
      ["tableau vide", []],
      ["nom vide", [{ name: "", secondaryDisciplines: [] }]],
      ["nom trop long", [{ name: "N".repeat(121), secondaryDisciplines: [] }]],
      ["email invalide", [{ name: "Email invalide", email: "pas-un-email", secondaryDisciplines: [] }]],
      ["âge hors limites", [{ name: "Age invalide", age: 101, secondaryDisciplines: [] }]],
      ["âge non entier", [{ name: "Age décimal", age: 20.5, secondaryDisciplines: [] }]],
      ["groupe trop long", [{ name: "Groupe long", group: "G".repeat(161), secondaryDisciplines: [] }]],
      ["secondaryDisciplines non tableau", [{ name: "Secondaires invalides", secondaryDisciplines: "100 m" }]],
      ["trop de disciplines secondaires", [{
        name: "Trop de disciplines",
        secondaryDisciplines: Array.from({ length: 21 }, (_, index) => `Discipline ${index}`),
      }]],
    ];
    for (const [label, payload] of invalidPayloads) {
      const { error } = await headA.client.rpc("import_club_athletes", { p_rows: payload });
      record(`validation serveur : ${label}`, Boolean(error), error ? "refusé, OK" : "ACCEPTÉ !");
    }
    {
      const tooManyRows = Array.from({ length: 501 }, (_, index) => ({
        name: `Limite ${index}`,
        secondaryDisciplines: [],
      }));
      const { error } = await headA.client.rpc("import_club_athletes", { p_rows: tooManyRows });
      record("limite serveur : 501 lignes refusées", Boolean(error), error ? "refusé, OK" : "ACCEPTÉ !");
    }

    // ── Doublons et atomicité : aucune ligne partielle ───────────────────────
    const beforeRejectedImports = await athleteCount(clubA.id);
    {
      const { error } = await headA.client.rpc("import_club_athletes", {
        p_rows: [{
          name: "Email déjà dans le club",
          email: headA.row.email.toUpperCase(),
          secondaryDisciplines: [],
        }],
      });
      record("email existant dans le même club refusé sans tenir compte de la casse", Boolean(error), error ? "refusé, OK" : "ACCEPTÉ !");
    }
    {
      const { error } = await headA.client.rpc("import_club_athletes", {
        p_rows: [{
          name: "Email d'un autre club",
          email: headB.row.email,
          secondaryDisciplines: [],
        }],
      });
      record("email déjà utilisé dans un autre club refusé", Boolean(error), error ? "refusé, OK" : "ACCEPTÉ !");
    }
    {
      const duplicateEmail = `import-duplicate-${RUN_ID}@example.invalid`;
      const { error } = await headA.client.rpc("import_club_athletes", {
        p_rows: [
          { name: "Doublon un", email: duplicateEmail, secondaryDisciplines: [] },
          { name: "Doublon deux", email: duplicateEmail.toUpperCase(), secondaryDisciplines: [] },
        ],
      });
      record("email dupliqué dans le même fichier refusé", Boolean(error), error ? "refusé, OK" : "ACCEPTÉ !");
    }
    {
      const atomicEmail = `import-atomic-${RUN_ID}@example.invalid`;
      const { error } = await headA.client.rpc("import_club_athletes", {
        p_rows: [
          { name: "Valide mais annulé", email: atomicEmail, secondaryDisciplines: [] },
          { name: "Ligne invalide", age: "vingt", secondaryDisciplines: [] },
        ],
      });
      const { data: leakedUser } = await admin.from("users").select("id").eq("email", atomicEmail).maybeSingle();
      record("une ligne invalide annule tout l'import", Boolean(error) && !leakedUser, leakedUser ? "utilisateur partiel créé !" : "aucune écriture, OK");
    }
    record(
      "les imports refusés n'ont créé aucun athlète",
      await athleteCount(clubA.id) === beforeRejectedImports,
      `avant=${beforeRejectedImports} après=${await athleteCount(clubA.id)}`,
    );

    // ── Import positif et cohérence users + athletes ──────────────────────────
    const importedEmail = `IMPORT-SUCCESS-${RUN_ID}@EXAMPLE.INVALID`;
    const successNames = [`Importé avec email ${RUN_ID}`, `Importé sans email ${RUN_ID}`];
    const { data: success, error: successError } = await headA.client.rpc("import_club_athletes", {
      p_rows: [
        {
          name: successNames[0],
          email: importedEmail,
          age: 21,
          mainDiscipline: "100 m",
          secondaryDisciplines: ["200 m", "4 × 100 m"],
          group: "Sprint",
          level: "National",
          clubId: clubB.id, // doit être totalement ignoré par le RPC
        },
        {
          name: successNames[1],
          email: "",
          age: null,
          mainDiscipline: "Longueur",
          secondaryDisciplines: [],
          group: "Sauts",
          level: "Régional",
        },
      ],
    });
    record(
      "head coach importe deux athlètes et reçoit importedCount",
      !successError && success?.importedCount === 2 && success?.createdUserCount === 1,
      successError?.message ?? JSON.stringify(success),
    );

    const { data: importedAthletes, error: importedError } = await admin
      .from("athletes")
      .select("id, club_id, name, age, main_discipline, group_name, user_id, profile_data")
      .in("name", successNames)
      .order("name");
    const withEmail = (importedAthletes ?? []).find((row) => row.name === successNames[0]);
    const withoutEmail = (importedAthletes ?? []).find((row) => row.name === successNames[1]);
    const { data: importedUser } = await admin
      .from("users")
      .select("id, club_id, email, role")
      .eq("email", importedEmail.toLowerCase())
      .maybeSingle();
    record(
      "le club vient du JWT et jamais du clubId client",
      !importedError
        && importedAthletes?.length === 2
        && importedAthletes.every((row) => row.club_id === clubA.id),
      importedError?.message,
    );
    record(
      "email présent : user athlete créé et relié dans le même club",
      Boolean(
        withEmail
        && importedUser
        && withEmail.user_id === importedUser.id
        && importedUser.club_id === clubA.id
        && importedUser.role === "athlete"
        && importedUser.email === importedEmail.toLowerCase()
      ),
      importedUser ? `user ${importedUser.id}` : "user manquant",
    );
    record(
      "email absent : aucun user artificiel, athlete tout de même créé",
      Boolean(withoutEmail && withoutEmail.user_id === null),
      withoutEmail ? `athlete ${withoutEmail.id}` : "athlete manquant",
    );
    record(
      "profil CSV conservé avec disciplines secondaires et valeurs par défaut",
      Boolean(
        withEmail?.profile_data?.level === "National"
        && withEmail?.profile_data?.secondary_disciplines?.length === 2
        && withEmail?.profile_data?.profile?.speed === 50
      ),
      JSON.stringify(withEmail?.profile_data ?? null),
    );

    // Le futur signup join_club doit réclamer exactement ces lignes au lieu
    // d'insérer un deuxième user/athlete. Appel direct service_role ici :
    // l'Edge Function signup est testée de bout en bout dans l'autre suite.
    const claimedAuthUid = crypto.randomUUID();
    const athleteCountBeforeClaim = await admin
      .from("athletes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", importedUser.id);
    const { data: claimResult, error: claimError } = await admin.rpc("signup_create_account", {
      p_mode: "join_club",
      p_club_name: "",
      p_invite_code: clubA.invite_code,
      p_auth_uid: claimedAuthUid,
      p_name: "Nom saisi à l'inscription",
      p_email: importedEmail.toLowerCase(),
    });
    const { data: claimedUser } = await admin
      .from("users")
      .select("id, auth_uid, name, club_id")
      .eq("id", importedUser.id)
      .single();
    const { data: claimedAthletes, count: athleteCountAfterClaim } = await admin
      .from("athletes")
      .select("id, name, profile_data", { count: "exact" })
      .eq("user_id", importedUser.id);
    record(
      "join_club réclame le user importé au lieu d'en créer un second",
      !claimError
        && claimResult?.claimedImportedAthlete === true
        && claimResult?.userId === importedUser.id
        && claimedUser?.id === importedUser.id
        && claimedUser?.auth_uid === claimedAuthUid
        && claimedUser?.club_id === clubA.id,
      claimError?.message ?? JSON.stringify(claimResult),
    );
    record(
      "la réclamation ne duplique ni n'écrase le profil athlete importé",
      athleteCountBeforeClaim.count === 1
        && athleteCountAfterClaim === 1
        && claimedAthletes?.[0]?.id === withEmail.id
        && claimedAthletes?.[0]?.name === successNames[0]
        && claimedAthletes?.[0]?.profile_data?.level === "National"
        && claimedUser?.name === successNames[0],
      `avant=${athleteCountBeforeClaim.count} après=${athleteCountAfterClaim}`,
    );
    {
      const { error } = await admin.rpc("signup_create_account", {
        p_mode: "join_club",
        p_club_name: "",
        p_invite_code: clubA.invite_code,
        p_auth_uid: crypto.randomUUID(),
        p_name: "Deuxième réclamation",
        p_email: importedEmail.toLowerCase(),
      });
      const { data: stillClaimed } = await admin.from("users").select("auth_uid").eq("id", importedUser.id).single();
      record(
        "un compte importé déjà lié ne peut pas être réclamé une seconde fois",
        Boolean(error) && stillClaimed?.auth_uid === claimedAuthUid,
        error ? "refusé, OK" : "COMPTE ÉCRASÉ !",
      );
    }

    // Un head coach d'un autre club peut importer, mais toujours dans SON club.
    const clubBName = `Import club B ${RUN_ID}`;
    const clubBEmail = `import-club-b-${RUN_ID}@example.invalid`;
    const { data: resultB, error: errorB } = await headB.client.rpc("import_club_athletes", {
      p_rows: [{ name: clubBName, email: clubBEmail, secondaryDisciplines: [], clubId: clubA.id }],
    });
    const { data: importedB } = await admin.from("athletes").select("club_id, user_id").eq("name", clubBName).single();
    record(
      "un autre head coach reste enfermé dans son propre club",
      !errorB && resultB?.importedCount === 1 && importedB?.club_id === clubB.id,
      errorB?.message,
    );
    {
      const { error } = await admin.rpc("signup_create_account", {
        p_mode: "join_club",
        p_club_name: "",
        p_invite_code: clubA.invite_code,
        p_auth_uid: crypto.randomUUID(),
        p_name: "Tentative inter-club",
        p_email: clubBEmail,
      });
      const { data: untouchedClubBUser } = await admin
        .from("users")
        .select("club_id, auth_uid")
        .eq("id", importedB.user_id)
        .single();
      record(
        "join_club ne peut jamais réclamer la ligne importée d'un autre club",
        Boolean(error) && untouchedClubBUser?.club_id === clubB.id && untouchedClubBUser?.auth_uid === null,
        error ? "refusé, OK" : "PRISE INTER-CLUB AUTORISÉE !",
      );
    }

    const { data: existingAfter } = await admin
      .from("athletes")
      .select("name, age, user_id")
      .eq("id", existingAthlete.id)
      .single();
    record(
      "l'import ne modifie ni ne supprime un athlète existant",
      existingAfter?.name === "Athlète existant intact"
        && existingAfter?.age === 22
        && existingAfter?.user_id === athleteA.row.id,
      JSON.stringify(existingAfter),
    );

    const beforeDuplicateRetry = await athleteCount(clubA.id);
    const { error: retryError } = await headA.client.rpc("import_club_athletes", {
      p_rows: [{ name: "Nouvelle tentative doublon", email: importedEmail, secondaryDisciplines: [] }],
    });
    record(
      "un email importé ne peut pas être réimporté",
      Boolean(retryError) && await athleteCount(clubA.id) === beforeDuplicateRetry,
      retryError ? "refusé, OK" : "DOUBLON CRÉÉ !",
    );
  } finally {
    console.log("\nNettoyage...");
    for (const account of accounts) await account.client.auth.signOut().catch(() => {});
    const clubIds = [clubA?.id, clubB?.id].filter(Boolean);
    if (clubIds.length) {
      await admin.from("athletes").delete().in("club_id", clubIds);
      await admin.from("users").delete().in("club_id", clubIds);
    }
    for (const account of accounts) await admin.auth.admin.deleteUser(account.auth.id).catch(() => {});
    if (clubA) await admin.from("clubs").delete().eq("id", clubA.id);
    if (clubB) await admin.from("clubs").delete().eq("id", clubB.id);
  }

  const failed = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) {
    console.error(`\n${failed.length} régression(s) détectée(s) :`);
    for (const failure of failed) console.error(`  - ${failure.name}${failure.detail ? ` : ${failure.detail}` : ""}`);
    process.exit(1);
  }
  console.log("\nImport transactionnel d'athlètes conforme.");
}

main().catch((error) => {
  console.error("Erreur fatale :", error?.message ?? error);
  process.exit(1);
});
