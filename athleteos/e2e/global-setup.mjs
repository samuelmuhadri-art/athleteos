// ============================================================
// AthleteOS — e2e/global-setup.mjs
//
// Crée 2 comptes éphémères RÉELS (auth + profil) avant les specs E2E
// authentifiées (coach-journey, athlete-journey) — le seed Supabase
// (supabase/seed.sql, tâche 5) contient des lignes `users` de démo mais
// AUCUN compte auth.users/mot de passe associé (décision assumée à la
// tâche 5, "pas de compte de connexion réel dans le seed"), donc rien
// à quoi se connecter par mot de passe sans cette étape.
//
// Ne tourne QUE contre un Supabase LOCAL éphémère (CI, `supabase start`
// — jamais la production) : ce script n'est déclenché que si
// E2E_WITH_AUTH est positionné (voir playwright.config.js), lui-même
// réservé au job CI qui vient de démarrer une instance locale jetable.
// Écrit les identifiants dans e2e/.auth-fixtures.json (gitignored),
// lus ensuite par coach-journey.spec.js / athlete-journey.spec.js.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SUPABASE_URL    = process.env.VITE_SUPABASE_URL ?? process.env.API_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

function assertLocalSupabase(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("e2e/global-setup.mjs : URL Supabase locale invalide.");
  }

  const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (parsed.protocol !== "http:" || !loopbackHosts.has(parsed.hostname)) {
    throw new Error(
      "e2e/global-setup.mjs : refus de créer des fixtures sur une instance Supabase non locale."
    );
  }
}

export default async function globalSetup() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "e2e/global-setup.mjs : VITE_SUPABASE_URL/API_URL et SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY " +
      "requis (instance Supabase locale — voir .github/workflows/ci.yml)."
    );
  }

  assertLocalSupabase(SUPABASE_URL);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const runId = Date.now();
  const password = `E2E-Test-${runId}-Aa!`;

  const { data: club, error: ce } = await admin.from("clubs").insert({ name: `E2E Club ${runId}` }).select().single();
  if (ce) throw new Error(`seed club : ${ce.message}`);

  async function makeAccount(email, name, role) {
    const { data: a, error: ea } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (ea) throw new Error(`createUser ${email} : ${ea.message}`);
    const { data: u, error: eu } = await admin.from("users")
      .insert({ club_id: club.id, name, email, role, auth_uid: a.user.id }).select().single();
    if (eu) throw new Error(`insert users ${email} : ${eu.message}`);
    if (role === "athlete") {
      const { error: eat } = await admin.from("athletes").insert({ club_id: club.id, name, user_id: u.id });
      if (eat) throw new Error(`insert athletes ${email} : ${eat.message}`);
    }
    return { email, password, authId: a.user.id, userId: u.id };
  }

  const coach   = await makeAccount(`e2e-coach-${runId}@example.invalid`, "E2E Coach", "head_coach");
  const athlete = await makeAccount(`e2e-athlete-${runId}@example.invalid`, "E2E Athlete", "athlete");

  const fixturesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), ".auth-fixtures.json");
  writeFileSync(fixturesPath, JSON.stringify({ runId, clubId: club.id, coach, athlete }, null, 2));

  // Pas de nettoyage automatique ici : l'instance Supabase locale est
  // jetable (détruite en fin de job CI, `supabase stop`), donc ces comptes
  // ne survivent jamais au run — inutile d'ajouter un teardown pour une
  // base qui va disparaître de toute façon.
}
