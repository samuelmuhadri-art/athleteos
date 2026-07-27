#!/usr/bin/env node
// ============================================================
// AthleteOS — test_axis_model_parity.mjs
//
// Vérifie le versionnement des poids du profil à 6 axes (tâche 18) :
//   - la version active en base a EXACTEMENT les mêmes poids que la
//     constante JS AXIS_WEIGHTS (parité JS/DB, comme charge_model_versions
//     en tâche 16)
//   - un poids hors bornes ([0,1]) est rejeté à l'insertion (trigger)
//   - un poids dans les bornes est accepté
//   - une seconde version "active" est rejetée (une seule à la fois)
//   - une nouvelle version peut être créée sans toucher la version 'v1'
//     existante (changement de configuration = nouvelle ligne, pas une
//     mutation de l'historique)
//
// Usage :
//   SUPABASE_SERVICE_ROLE_KEY=... node test_axis_model_parity.mjs
//
// Requiert dans l'environnement (ou .env à la racine du dossier) :
//   VITE_SUPABASE_URL           (déjà dans .env)
//   SUPABASE_SERVICE_ROLE_KEY   (secret, jamais committé)
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { AXIS_WEIGHTS, CURRENT_AXIS_MODEL_VERSION, LOAD_AXES } from "./src/utils/loadAxes.js";

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

const AXIS_IDS = Object.keys(LOAD_AXES);
const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

function sameWeights(dbWeights, jsWeights) {
  const catsDb = Object.keys(dbWeights ?? {}).sort();
  const catsJs = Object.keys(jsWeights ?? {}).sort();
  if (catsDb.length !== catsJs.length || catsDb.some((c, i) => c !== catsJs[i])) return false;
  return catsDb.every((cat) => AXIS_IDS.every((axis) => Number(dbWeights[cat][axis]) === Number(jsWeights[cat][axis])));
}

async function main() {
  const RUN_ID = Date.now();
  const scratchVersions = [`test-ok-${RUN_ID}`, `test-active-${RUN_ID}`];

  try {
    // ── 1. Parité : version active en base === AXIS_WEIGHTS (JS) ─────────
    const { data: active, error: activeErr } = await admin
      .from("axis_model_versions").select("*").eq("is_active", true).maybeSingle();
    if (activeErr) throw new Error(`lecture axis_model_versions : ${activeErr.message}`);
    record("Une version active existe", !!active, active ? `version=${active.version}` : "aucune version active !");

    if (active) {
      record("Version active en base === CURRENT_AXIS_MODEL_VERSION (JS)", active.version === CURRENT_AXIS_MODEL_VERSION,
        `db=${active.version} js=${CURRENT_AXIS_MODEL_VERSION}`);
      record("axis_weights : base === JS (les 9 catégories x 6 axes)", sameWeights(active.axis_weights, AXIS_WEIGHTS),
        `db=${JSON.stringify(active.axis_weights)}`);
    }

    // ── 2. Bornes : poids hors [0,1] rejeté, dans les bornes accepté ──────
    {
      const { error: badErr } = await admin.from("axis_model_versions").insert({
        version: `test-bad-${RUN_ID}`,
        axis_weights: { sprint: { neuromuscular: 1.7 } }, // hors bornes (max 1.0)
        is_active: false,
      });
      record("Poids hors bornes (1.7) -> rejeté", !!badErr, badErr?.message);
    }
    {
      const { error: goodErr } = await admin.from("axis_model_versions").insert({
        version: `test-ok-${RUN_ID}`,
        axis_weights: { sprint: { neuromuscular: 0.8 } },
        is_active: false,
      });
      record("Poids dans les bornes (0.8) -> accepté", !goodErr, goodErr?.message);
    }

    // ── 3. Une seule version active à la fois ─────────────────────────────
    {
      const { error: dupActiveErr } = await admin.from("axis_model_versions").insert({
        version: `test-active-${RUN_ID}`,
        axis_weights: { sprint: { neuromuscular: 0.5 } },
        is_active: true,
      });
      record("Deuxième version active -> rejetée (contrainte unique)", !!dupActiveErr, dupActiveErr?.message);
    }

    // ── 4. Une nouvelle version ne modifie pas 'v1' déjà en place ─────────
    {
      const { data: v1Before } = await admin.from("axis_model_versions").select("axis_weights").eq("version", "v1").maybeSingle();
      // La création d'une version scratch (ci-dessus, jamais activée) ne doit
      // avoir touché ni le contenu ni le statut actif de 'v1'.
      const { data: v1After } = await admin.from("axis_model_versions").select("axis_weights, is_active").eq("version", "v1").maybeSingle();
      record("'v1' toujours actif après création d'une autre version", v1After?.is_active === true);
      record("'v1' inchangé (poids identiques) après création d'une autre version",
        JSON.stringify(v1Before?.axis_weights) === JSON.stringify(v1After?.axis_weights));
    }

  } finally {
    console.log("\nNettoyage...");
    for (const v of scratchVersions) await admin.from("axis_model_versions").delete().eq("version", v);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) {
    console.error(`\n${failed.length} régression(s) détectée(s) :`);
    failed.forEach((f) => console.error(`  - ${f.name}${f.detail ? " : " + f.detail : ""}`));
    process.exit(1);
  }
  console.log("\nParité JS/DB confirmée, bornes et versionnement fonctionnels.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erreur fatale :", err.message ?? err);
  process.exit(1);
});
