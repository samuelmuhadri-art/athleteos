#!/usr/bin/env node
// ============================================================
// AthleteOS — test_private_storage.mjs
//
// Vérifie en conditions réelles (tâche 8) que le bucket session-pdfs,
// désormais privé, respecte les "Vérifications obligatoires" de la
// tâche :
//   1. Upload coach autorisé (club A, dossier club A).
//   2. Upload athlète autorisé (club A, dossier club A) — mêmes règles
//      que le coach, c'est le comportement existant (auto-planification).
//   3. Téléchargement par un autre club refusé : ni createSignedUrl(),
//      ni .list(), ni l'ancienne URL publique (le bucket n'est plus public).
//   4. Une URL signée expire (TTL 1s) et devient inutilisable après.
//   5. Un fichier dont le Content-Type déclaré n'est pas application/pdf
//      est rejeté par le bucket (allowed_mime_types, contrôle serveur).
//   + Limite de taille (file_size_limit) appliquée côté serveur.
//   + Round-trip complet : upload → createSignedUrl → fetch → 200.
//
// Note honnête : Supabase Storage ne fait PAS de sniffing du contenu
// réel du fichier, seulement du Content-Type déclaré à l'upload. Un
// fichier renommé en .pdf avec un Content-Type mensonger "application/pdf"
// passerait ce contrôle — une vraie inspection de contenu demanderait une
// Edge Function dédiée (magic bytes), disproportionné ici : les uploads
// viennent de comptes authentifiés du club (coach/athlète), pas d'un
// dépôt public anonyme (cf. tâche 8 : quarantaine/antivirus seulement
// "si des documents externes sont acceptés à grande échelle" — non le cas).
//
// Crée deux clubs et deux comptes éphémères, nettoie tout à la fin.
//
// Usage :
//   SUPABASE_SERVICE_ROLE_KEY=... node test_private_storage.mjs
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
const ANON_KEY          = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error(
    "Variables manquantes. Requis : VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY " +
    "(dans .env) et SUPABASE_SERVICE_ROLE_KEY (variable d'environnement, jamais committée)."
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const RUN_ID = Date.now();
const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

async function insertOrThrow(table, row) {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw new Error(`seed ${table} : ${error.message}`);
  return data;
}

async function makeUser(email, password, clubId, role, name) {
  const { data: a, error: ea } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (ea) throw new Error(`createUser ${email} : ${ea.message}`);
  const u = await insertOrThrow("users", { club_id: clubId, name, email, role, auth_uid: a.user.id });
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: es } = await client.auth.signInWithPassword({ email, password });
  if (es) throw new Error(`signIn ${email} : ${es.message}`);
  return { auth: a.user, row: u, client };
}

const PDF_BYTES = Buffer.from("%PDF-1.4\n%fake-test-pdf\n", "utf8");

async function main() {
  let clubA, clubB;
  const auths = [];
  const uploadedPaths = []; // nettoyage via admin, quel que soit le résultat des tests
  const password = `Storage-Test-${RUN_ID}-Aa!`;

  try {
    clubA = await insertOrThrow("clubs", { name: `Storage Test Club A ${RUN_ID}` });
    clubB = await insertOrThrow("clubs", { name: `Storage Test Club B ${RUN_ID}` });

    const coachA   = await makeUser(`storage-test-coacha-${RUN_ID}@example.invalid`,   password, clubA.id, "coach",   "Coach A");   auths.push(coachA);
    const athleteA = await makeUser(`storage-test-athletea-${RUN_ID}@example.invalid`, password, clubA.id, "athlete", "Athlete A"); auths.push(athleteA);
    const athleteB = await makeUser(`storage-test-athleteb-${RUN_ID}@example.invalid`, password, clubB.id, "athlete", "Athlete B"); auths.push(athleteB);

    // ── 1. Upload coach autorisé ────────────────────────────────────────────
    const pathA1 = `${clubA.id}/${RUN_ID}-coach.pdf`;
    {
      const { error } = await coachA.client.storage.from("session-pdfs").upload(pathA1, PDF_BYTES, { contentType: "application/pdf" });
      if (!error) uploadedPaths.push(pathA1);
      record("upload coach autorisé (dossier de son club)", !error, error?.message);
    }

    // ── 2. Upload athlète autorisé (mêmes règles que le coach) ─────────────
    const pathA2 = `${clubA.id}/${RUN_ID}-athlete.pdf`;
    {
      const { error } = await athleteA.client.storage.from("session-pdfs").upload(pathA2, PDF_BYTES, { contentType: "application/pdf" });
      if (!error) uploadedPaths.push(pathA2);
      record("upload athlète autorisé (dossier de son club)", !error, error?.message);
    }

    // ── upload dans le dossier d'un AUTRE club refusé (déjà couvert par la
    //    tâche antérieure sur les policies, revérifié ici car directement
    //    lié à la même surface : écrit dans le dossier club A en étant du
    //    club B) ─────────────────────────────────────────────────────────
    {
      const { error } = await athleteB.client.storage.from("session-pdfs").upload(`${clubA.id}/${RUN_ID}-intrusion.pdf`, PDF_BYTES, { contentType: "application/pdf" });
      record("upload refusé (athlète club B dans le dossier du club A)", !!error, error ? "refusé, OK" : "AUTORISÉ !");
    }

    // ── 3. Téléchargement par un autre club refusé ──────────────────────────
    {
      const { error } = await athleteB.client.storage.from("session-pdfs").createSignedUrl(pathA1, 60);
      record("createSignedUrl refusé (athlète club B sur fichier club A)", !!error, error ? "refusé, OK" : "AUTORISÉ !");
    }
    {
      const { data, error } = await athleteB.client.storage.from("session-pdfs").list(String(clubA.id));
      const leaked = (data ?? []).length > 0;
      record("list() ne révèle rien du dossier club A à un compte club B", !leaked, error ? `erreur (OK aussi): ${error.message}` : `${data?.length ?? 0} fichier(s) visible(s)`);
    }
    {
      // Ancienne convention d'URL publique — doit être morte maintenant que
      // le bucket n'est plus public (couvre le point du DoD "aucune URL
      // ancienne publique ne donne accès aux nouveaux fichiers privés").
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/session-pdfs/${pathA1}`);
      record("l'ancienne URL publique ne fonctionne plus (bucket privé)", res.status !== 200, `HTTP ${res.status}`);
    }

    // ── 4. Une URL signée expire ────────────────────────────────────────────
    {
      const { data, error } = await coachA.client.storage.from("session-pdfs").createSignedUrl(pathA1, 1);
      if (error) {
        record("URL signée générée (préalable au test d'expiration)", false, error.message);
      } else {
        await new Promise(r => setTimeout(r, 2500));
        const res = await fetch(data.signedUrl);
        record("URL signée expirée refusée après son TTL", res.status !== 200, `HTTP ${res.status}`);
      }
    }

    // ── round-trip complet : une URL signée valide fonctionne bien (UX préservée) ──
    {
      const { data, error } = await coachA.client.storage.from("session-pdfs").createSignedUrl(pathA1, 60);
      if (error) {
        record("URL signée valide → 200", false, error.message);
      } else {
        const res = await fetch(data.signedUrl);
        record("URL signée valide → 200 (le PDF s'ouvre bien)", res.status === 200, `HTTP ${res.status}`);
      }
    }

    // ── 5. MIME trompeur refusé côté serveur ────────────────────────────────
    {
      const { error } = await coachA.client.storage.from("session-pdfs").upload(
        `${clubA.id}/${RUN_ID}-fake.pdf`, Buffer.from("<html>pas un pdf</html>"), { contentType: "text/html" }
      );
      record("upload refusé (Content-Type non autorisé par le bucket)", !!error, error ? "refusé, OK" : "AUTORISÉ !");
    }

    // ── limite de taille appliquée côté serveur (31 Mo > 30 Mo autorisés) ──
    {
      const big = Buffer.alloc(31 * 1024 * 1024, 1);
      const { error } = await coachA.client.storage.from("session-pdfs").upload(
        `${clubA.id}/${RUN_ID}-big.pdf`, big, { contentType: "application/pdf" }
      );
      record("upload refusé (fichier > 30 Mo, limite serveur)", !!error, error ? "refusé, OK" : "AUTORISÉ !");
    }

  } finally {
    console.log("\nNettoyage...");
    // .storage.from(...).remove()/.upload() sont de vraies Promises (client
    // storage-js, pas le query builder postgrest-js) — .catch() est valide
    // ici, contrairement à admin.from(table)... (déjà rencontré tâches 3/4/14).
    if (uploadedPaths.length) await admin.storage.from("session-pdfs").remove(uploadedPaths).catch(() => {});
    for (const u of auths) {
      if (!u) continue;
      await u.client.auth.signOut().catch(() => {});
      await admin.from("athletes").delete().eq("user_id", u.row.id);
      await admin.from("users").delete().eq("id", u.row.id);
      await admin.auth.admin.deleteUser(u.auth.id).catch(() => {});
    }
    if (clubA) await admin.from("clubs").delete().eq("id", clubA.id);
    if (clubB) await admin.from("clubs").delete().eq("id", clubB.id);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) {
    console.error(`\n${failed.length} régression(s) détectée(s) :`);
    failed.forEach((f) => console.error(`  - ${f.name}${f.detail ? " : " + f.detail : ""}`));
    process.exit(1);
  }
  console.log("\nStockage privé session-pdfs conforme.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur fatale :", err.message ?? err);
  process.exit(1);
});
