#!/usr/bin/env node
// ============================================================
// AthleteOS — test_signup_regression.mjs
//
// Vérifie le durcissement de l'Edge Function signup (tâche 3) :
//   - création de club valide (mode create_club)
//   - adhésion par code valide (mode join_club)
//   - code d'invitation invalide -> rejeté, sans créer de compte Auth
//   - email déjà existant -> réponse IDENTIQUE à un succès (anti-énumération)
//   - honeypot rempli -> rejeté (anti-bot, équivalent CAPTCHA)
//   - soumission trop rapide (< délai minimum) -> rejetée (anti-bot)
//   - rate limit par IP dépassé -> 429
//   - échec forcé après création Auth -> compensation (compte Auth supprimé,
//     aucune ligne club/users/athletes orpheline) — nécessite
//     SIGNUP_TEST_MODE=true dans les secrets de la fonction pendant ce test
//     (à retirer juste après, ce flag ne doit jamais rester actif en prod)
//
// Usage :
//   SUPABASE_SERVICE_ROLE_KEY=... node test_signup_regression.mjs
//
// Requiert dans l'environnement (ou .env à la racine du dossier) :
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (déjà dans .env)
//   SUPABASE_SERVICE_ROLE_KEY                  (secret, jamais committé)
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

function loadDotEnv(filePath) {
  let text;
  try { text = readFileSync(filePath, "utf8"); } catch { return; }
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}
loadDotEnv(path.join(path.dirname(fileURLToPath(import.meta.url)), ".env"));

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL;
const ANON_KEY         = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error(
    "Variables manquantes. Requis : VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY " +
    "(dans .env) et SUPABASE_SERVICE_ROLE_KEY (variable d'environnement, jamais committée)."
  );
  process.exit(1);
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/signup`;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_ID = Date.now();

// Même alphabet que CODE_CHARS côté serveur (supabase/functions/signup) —
// sans 0/O/1/I/L pour éviter les confusions. Un code de test qui contient un
// caractère hors de cet alphabet est rejeté par la validation serveur (à
// raison), peu importe qu'un club existe avec ce code — d'où l'utilisation
// d'un vrai code aléatoire plutôt que des chiffres bruts d'un timestamp
// (qui contiennent presque toujours un 0 ou un 1).
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomTestCode(len = 8) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}
const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

// Body "propre" : passe le honeypot et le délai minimum anti-bot.
function baseBody(overrides) {
  return {
    company: "",
    formLoadedAt: Date.now() - 3000, // 3s avant l'appel, au-dessus du seuil (1.5s)
    ...overrides,
  };
}

async function callSignup(body) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* pas de corps JSON */ }
  return { status: res.status, json };
}

async function cleanupByEmail(email) {
  const { data: userRow } = await admin.from("users").select("id, club_id, auth_uid").eq("email", email).maybeSingle();
  if (userRow) {
    await admin.from("athletes").delete().eq("user_id", userRow.id);
    await admin.from("users").delete().eq("id", userRow.id);
    if (userRow.club_id) await admin.from("clubs").delete().eq("id", userRow.club_id);
    if (userRow.auth_uid) await admin.auth.admin.deleteUser(userRow.auth_uid).catch(() => {});
  }
  // Au cas où la ligne users n'a pas été créée mais le compte Auth oui
  // (ne devrait pas arriver grâce à la compensation, mais on nettoie large).
  const { data: authList } = await admin.auth.admin.listUsers();
  const orphan = authList?.users?.find((u) => u.email === email);
  if (orphan) await admin.auth.admin.deleteUser(orphan.id).catch(() => {});
}

async function main() {
  const createdEmails = [];
  let existingClub;

  try {
    // ── Setup : un club existant avec un code valide, pour tester join_club ──
    existingClub = await admin.from("clubs")
      .insert({ name: `Signup Test Club ${RUN_ID}`, invite_code: randomTestCode() })
      .select().single().then((r) => { if (r.error) throw r.error; return r.data; });
    const validInviteCode = existingClub.invite_code;

    // ── 1. Création de club valide ──────────────────────────────────
    const createEmail = `signup-test-create-${RUN_ID}@example.invalid`;
    createdEmails.push(createEmail);
    {
      const { status, json } = await callSignup(baseBody({
        mode: "create_club", name: "Coach Test", email: createEmail, password: `Test-${RUN_ID}-Aa!`,
        clubName: `Nouveau Club ${RUN_ID}`,
      }));
      record("Création club valide -> succès", status === 200 && json?.success === true, `status=${status} body=${JSON.stringify(json)}`);
    }

    // ── 2. Adhésion par code valide ─────────────────────────────────
    const joinEmail = `signup-test-join-${RUN_ID}@example.invalid`;
    createdEmails.push(joinEmail);
    {
      const { status, json } = await callSignup(baseBody({
        mode: "join_club", name: "Athlete Test", email: joinEmail, password: `Test-${RUN_ID}-Aa!`,
        inviteCode: validInviteCode,
      }));
      record("Adhésion code valide -> succès", status === 200 && json?.success === true, `status=${status} body=${JSON.stringify(json)}`);
    }
    // Vérifie que l'athlète a bien été rattaché au bon club (RPC atomique).
    {
      const { data: row } = await admin.from("users").select("club_id, role").eq("email", joinEmail).maybeSingle();
      record("Adhésion -> rattaché au bon club + rôle athlete", row?.club_id === existingClub.id && row?.role === "athlete", JSON.stringify(row));
    }

    // ── 3. Code d'invitation invalide ───────────────────────────────
    {
      const { status, json } = await callSignup(baseBody({
        mode: "join_club", name: "Nobody", email: `signup-test-badcode-${RUN_ID}@example.invalid`,
        password: `Test-${RUN_ID}-Aa!`, inviteCode: "ZZZZZZZZ",
      }));
      record("Code invalide -> rejeté (400)", status === 400 && json?.success === false, `status=${status}`);
    }

    // ── 4. Email déjà existant -> réponse identique à un succès ─────
    {
      const { status, json } = await callSignup(baseBody({
        mode: "create_club", name: "Coach Test", email: createEmail, // déjà utilisé à l'étape 1
        password: `Autre-${RUN_ID}-Bb!`, clubName: "Club Fantome",
      }));
      record("Email existant -> même forme qu'un succès (anti-énumération)", status === 200 && json?.success === true, `status=${status} body=${JSON.stringify(json)}`);
    }
    // Vérifie qu'aucun second compte/club n'a été créé pour cet email.
    {
      const { data: rows } = await admin.from("users").select("id").eq("email", createEmail);
      record("Email existant -> aucun doublon créé", (rows ?? []).length === 1, `count=${(rows ?? []).length}`);
    }

    // ── 5. Honeypot rempli -> rejeté (équivalent CAPTCHA) ────────────
    {
      const { status, json } = await callSignup(baseBody({
        mode: "create_club", name: "Bot", email: `signup-test-bot-${RUN_ID}@example.invalid`,
        password: `Test-${RUN_ID}-Aa!`, clubName: "Bot Club", company: "http://spam.example",
      }));
      record("Honeypot rempli -> rejeté (400)", status === 400 && json?.success === false, `status=${status}`);
    }

    // ── 6. Soumission trop rapide -> rejetée (équivalent CAPTCHA) ────
    {
      const { status, json } = await callSignup(baseBody({
        mode: "create_club", name: "Bot", email: `signup-test-fast-${RUN_ID}@example.invalid`,
        password: `Test-${RUN_ID}-Aa!`, clubName: "Fast Club", formLoadedAt: Date.now(), // 0ms écoulé
      }));
      record("Soumission trop rapide -> rejetée (400)", status === 400 && json?.success === false, `status=${status}`);
    }

    // ── 7. Échec forcé après création Auth -> compensation ───────────
    // Nécessite SIGNUP_TEST_MODE=true dans les secrets de la fonction.
    // Si ce n'est pas le cas, le flag est inerte et ce test est ignoré
    // (annoncé explicitement, pas de faux positif). Fait AVANT le test de
    // rate limit ci-dessous : celui-ci épuise volontairement le quota IP,
    // ce qui ferait échouer cet appel-ci en 429 s'il passait après.
    {
      const compEmail = `signup-test-compensation-${RUN_ID}@example.invalid`;
      const { status, json } = await callSignup(baseBody({
        mode: "create_club", name: "Compensation Test", email: compEmail,
        password: `Test-${RUN_ID}-Aa!`, clubName: "Compensation Club",
        __test_force_db_failure: true,
      }));
      if (status === 500) {
        const { data: authList } = await admin.auth.admin.listUsers();
        const orphanAuth = authList?.users?.find((u) => u.email === compEmail);
        const { data: orphanUserRow } = await admin.from("users").select("id").eq("email", compEmail).maybeSingle();
        record("Compensation : pas de compte Auth orphelin", !orphanAuth, orphanAuth ? "compte Auth encore présent !" : "nettoyé, OK");
        record("Compensation : pas de ligne users orpheline", !orphanUserRow, orphanUserRow ? "ligne users encore présente !" : "aucune, OK");
      } else {
        console.log(`⚠️  Test de compensation ignoré (SIGNUP_TEST_MODE n'est probablement pas activé sur la fonction) — status=${status} body=${JSON.stringify(json)}`);
      }
    }

    // ── 8. Rate limit par IP dépassé ─────────────────────────────────
    // La limite est à 8 tentatives/15min par IP ; les appels précédents dans
    // ce run en comptent déjà plusieurs (même IP source : ce script). On
    // envoie des tentatives supplémentaires jusqu'à obtenir un 429, avec un
    // plafond de sécurité pour ne pas boucler indéfiniment si jamais la
    // limite ne déclenche pas. Dernier test métier du script — après ça,
    // l'IP est volontairement au-dessus du quota.
    {
      let hit429 = false;
      for (let i = 0; i < 10 && !hit429; i++) {
        const { status } = await callSignup(baseBody({
          mode: "join_club", name: "Rate Test", email: `signup-test-rate-${RUN_ID}-${i}@example.invalid`,
          password: `Test-${RUN_ID}-Aa!`, inviteCode: "ZZZZZZZZ", // volontairement invalide, peu importe ici
        }));
        if (status === 429) hit429 = true;
      }
      record("Rate limit IP dépassé -> 429 obtenu", hit429);
    }

  } finally {
    console.log("\nNettoyage...");
    for (const email of createdEmails) await cleanupByEmail(email);
    await cleanupByEmail(`signup-test-compensation-${RUN_ID}@example.invalid`);
    for (let i = 0; i < 10; i++) await cleanupByEmail(`signup-test-rate-${RUN_ID}-${i}@example.invalid`);
    if (existingClub) await admin.from("clubs").delete().eq("id", existingClub.id);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) {
    console.error(`\n${failed.length} régression(s) signup détectée(s) :`);
    failed.forEach((f) => console.error(`  - ${f.name}${f.detail ? " : " + f.detail : ""}`));
    process.exit(1);
  }
  console.log("\nAucune régression détectée sur signup.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur fatale :", err.message ?? err);
  process.exit(1);
});
