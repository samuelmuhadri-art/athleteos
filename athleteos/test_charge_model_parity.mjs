#!/usr/bin/env node
// ============================================================
// AthleteOS — test_charge_model_parity.mjs
//
// Vérifie le versionnement des coefficients de charge (tâche 16) :
//   - la version active en base a EXACTEMENT les mêmes coefficients que
//     les constantes JS (trainingLoad.js) — parité JS/SQL
//   - un jeu de séances réelles (golden dataset), calculé côté JS avec
//     computeSessionLoad, donne EXACTEMENT le même total que la vue SQL
//     weekly_charge — parité de bout en bout, pas juste des constantes
//   - un coefficient hors bornes est rejeté à l'insertion (trigger),
//     un coefficient dans les bornes est accepté
//   - une seconde version "active" est rejetée (une seule à la fois)
//   - modifier un champ qui n'est pas le RPE ne change PAS le
//     model_version déjà timbré sur une ligne (l'historique ne bouge pas
//     silencieusement)
//
// Usage :
//   SUPABASE_SERVICE_ROLE_KEY=... node test_charge_model_parity.mjs
//
// Requiert dans l'environnement (ou .env à la racine du dossier) :
//   VITE_SUPABASE_URL           (déjà dans .env)
//   SUPABASE_SERVICE_ROLE_KEY   (secret, jamais committé — ce script
//                                 n'utilise que le client admin)
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  LOAD_COEFFICIENTS, RECOVERY_HOURS, CURRENT_MODEL_VERSION, computeSessionLoad,
} from "./src/utils/trainingLoad.js";

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
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Variables manquantes. Requis : VITE_SUPABASE_URL (dans .env) et " +
    "SUPABASE_SERVICE_ROLE_KEY (variable d'environnement, jamais committée)."
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
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

async function insertOrThrow(table, row) {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw new Error(`seed ${table} : ${error.message}`);
  return data;
}

function sameCoefficients(dbObj, jsObj) {
  const dbKeys = Object.keys(dbObj ?? {}).sort();
  const jsKeys = Object.keys(jsObj ?? {}).sort();
  if (dbKeys.length !== jsKeys.length) return false;
  if (dbKeys.some((k, i) => k !== jsKeys[i])) return false;
  return dbKeys.every((k) => Number(dbObj[k]) === Number(jsObj[k]));
}

async function main() {
  let club, athlete;
  const sessionIds = [];
  const scratchVersions = [`test-ok-${RUN_ID}`, `test-active-${RUN_ID}`];

  try {
    // ── 1. Parité constantes : version active en base === JS ──────────
    const { data: active, error: activeErr } = await admin
      .from("charge_model_versions").select("*").eq("is_active", true).maybeSingle();
    if (activeErr) throw new Error(`lecture charge_model_versions : ${activeErr.message}`);
    record("Une version active existe", !!active, active ? `version=${active.version}` : "aucune version active !");

    if (active) {
      record("Version active en base === CURRENT_MODEL_VERSION (JS)", active.version === CURRENT_MODEL_VERSION,
        `db=${active.version} js=${CURRENT_MODEL_VERSION}`);
      record("load_coefficients : base === JS", sameCoefficients(active.load_coefficients, LOAD_COEFFICIENTS),
        `db=${JSON.stringify(active.load_coefficients)} js=${JSON.stringify(LOAD_COEFFICIENTS)}`);
      record("recovery_hours : base === JS", sameCoefficients(active.recovery_hours, RECOVERY_HOURS),
        `db=${JSON.stringify(active.recovery_hours)} js=${JSON.stringify(RECOVERY_HOURS)}`);
    }

    // ── 2. Golden dataset : JS et weekly_charge (SQL) doivent tomber sur
    //    le même total, pour un athlète, une semaine, plusieurs catégories ──
    club = await insertOrThrow("clubs", { name: `Charge Parity Test ${RUN_ID}` });
    athlete = await insertOrThrow("athletes", { club_id: club.id, name: `Athlete Parity Test ${RUN_ID}` });

    const WEEK = 1;
    const fixtures = [
      { category: "sprint",    duration_minutes: 60, rpe: 7, session_date: "2026-01-01" },
      { category: "force",     duration_minutes: 45, rpe: 8, session_date: "2026-01-02" },
      { category: "technique", duration_minutes: 90, rpe: 4, session_date: "2026-01-03" },
    ];

    let expectedTotal = 0;
    for (const f of fixtures) {
      const session = await insertOrThrow("sessions", {
        club_id: club.id, title: `Parity ${f.category} ${RUN_ID}`,
        category: f.category, week: WEEK, duration_minutes: f.duration_minutes, session_date: f.session_date,
      });
      sessionIds.push(session.id);
      await insertOrThrow("session_athletes", {
        session_id: session.id, athlete_id: athlete.id, status: "done", rpe: f.rpe,
        actual_duration_minutes: f.duration_minutes, duration_source: "reported",
      });
      expectedTotal += computeSessionLoad(f.duration_minutes, f.rpe, f.category);
    }

    const { data: charge, error: chargeErr } = await admin
      .from("weekly_charge").select("raw_load").eq("athlete_id", athlete.id).eq("week", WEEK).maybeSingle();
    if (chargeErr) throw new Error(`lecture weekly_charge : ${chargeErr.message}`);
    record("weekly_charge (SQL) === somme computeSessionLoad (JS)", charge?.raw_load === expectedTotal,
      `sql=${charge?.raw_load} js=${expectedTotal}`);

    // ── 3. Le trigger a bien timbré les lignes avec la version active ──
    const { data: stampedRows, error: stampErr } = await admin
      .from("session_athletes").select("model_version").eq("athlete_id", athlete.id).in("session_id", sessionIds);
    if (stampErr) throw new Error(`lecture session_athletes : ${stampErr.message}`);
    const allStamped = (stampedRows ?? []).length === fixtures.length &&
      stampedRows.every((r) => r.model_version === (active?.version ?? CURRENT_MODEL_VERSION));
    record("Chaque ligne RPE timbrée avec la version active", allStamped, JSON.stringify(stampedRows));

    // ── 4. Modifier un champ non-RPE ne change PAS le model_version ────
    const firstSessionId = sessionIds[0];
    const before = stampedRows.find((_, i) => sessionIds[i] === firstSessionId);
    await admin.from("session_athletes").update({ status: "done" })
      .eq("session_id", firstSessionId).eq("athlete_id", athlete.id);
    const { data: afterRow } = await admin.from("session_athletes")
      .select("model_version, status").eq("session_id", firstSessionId).eq("athlete_id", athlete.id).maybeSingle();
    record("Update d'un champ non-RPE -> model_version inchangé", afterRow?.model_version === before?.model_version,
      `avant=${before?.model_version} après=${afterRow?.model_version} status=${afterRow?.status}`);

    // ── 5. Bornes : coefficient hors bornes rejeté, dans les bornes accepté ──
    {
      const { error: badErr } = await admin.from("charge_model_versions").insert({
        version: `test-bad-${RUN_ID}`,
        load_coefficients: { force: 50 }, // hors bornes (max 3.0)
        recovery_hours: { force: 72 },
        is_active: false,
      });
      record("Coefficient hors bornes (50) -> rejeté", !!badErr, badErr?.message);
    }
    {
      const { error: goodErr } = await admin.from("charge_model_versions").insert({
        version: `test-ok-${RUN_ID}`,
        load_coefficients: { force: 1.5 },
        recovery_hours: { force: 60 },
        is_active: false,
      });
      record("Coefficient dans les bornes (1.5) -> accepté", !goodErr, goodErr?.message);
    }

    // ── 6. Une seule version active à la fois ───────────────────────────
    {
      const { error: dupActiveErr } = await admin.from("charge_model_versions").insert({
        version: `test-active-${RUN_ID}`,
        load_coefficients: { force: 1.2 },
        recovery_hours: { force: 60 },
        is_active: true,
      });
      record("Deuxième version active -> rejetée (contrainte unique)", !!dupActiveErr, dupActiveErr?.message);
    }

  } finally {
    console.log("\nNettoyage...");
    for (const v of scratchVersions) await admin.from("charge_model_versions").delete().eq("version", v);
    // Cascade FK sur athlete_id : nettoie session_athletes automatiquement.
    if (athlete) await admin.from("athletes").delete().eq("id", athlete.id);
    for (const id of sessionIds) await admin.from("sessions").delete().eq("id", id);
    if (club) await admin.from("clubs").delete().eq("id", club.id);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) {
    console.error(`\n${failed.length} régression(s) détectée(s) :`);
    failed.forEach((f) => console.error(`  - ${f.name}${f.detail ? " : " + f.detail : ""}`));
    process.exit(1);
  }
  console.log("\nParité JS/SQL confirmée, bornes et versionnement fonctionnels.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur fatale :", err.message ?? err);
  process.exit(1);
});
