#!/usr/bin/env node
// ============================================================
// AthleteOS — test_recovery_estimate.mjs
//
// Vérifie estimateRecovery() (tâche 17) — fonction pure, aucune base de
// données requise, s'exécute directement avec `node`.
//
//   - aucune séance récente -> "insufficient_data", jamais une fausse
//     certitude ("fullyRecovered: true" comme avant)
//   - même séance, wellness différent -> estimation différente
//   - aucune donnée subjective (wellness=null) -> fonctionne quand même,
//     avec une confiance plus basse
//   - wellness présent mais ancien -> traité comme absent (pas de facteur
//     wellness dans la liste, confiance plus basse que "frais")
//   - valeurs extrêmes (RPE 10, forte charge) -> la plage reste dans les
//     bornes de la catégorie, la confiance reste dans [0,100]
//
// Usage : node test_recovery_estimate.mjs
// ============================================================

import { estimateRecovery, RECOVERY_HOURS_RANGE } from "./src/utils/trainingLoad.js";

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

function doneSession({ id, category, durationMinutes, rpe, daysAgo }) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  const sessionDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return {
    id, category, durationMinutes, sessionDate,
    validations: [{ athleteId: 1, status: "done", rpe }],
  };
}

// ── 1. Aucune séance -> données insuffisantes, jamais une fausse certitude ──
{
  const r = estimateRecovery([], 1, null, new Date());
  record("Aucune séance -> status insufficient_data", r.status === "insufficient_data", JSON.stringify(r));
  record("Aucune séance -> pas de fausse certitude (rangeHoursMin/Max = null)", r.rangeHoursMin === null && r.rangeHoursMax === null);
}

// ── 2. Séance seule, sans wellness -> estimation valide, confiance limitée ──
const baseSession = doneSession({ id: 1, category: "sprint", durationMinutes: 60, rpe: 8, daysAgo: 1 });
{
  const r = estimateRecovery([baseSession], 1, null, new Date());
  record("Séance seule, sans wellness -> statut valide (pas insuffisant)", r.status !== "insufficient_data", r.status);
  record("Plage dans les bornes de la catégorie (sprint 48-96h avant écoulement)",
    r.rangeHoursMin >= 0 && r.rangeHoursMax <= RECOVERY_HOURS_RANGE.sprint.max, JSON.stringify(r));
}

// ── 3. Même séance, wellness différent -> estimations différentes ──────────
{
  const now = new Date();
  const wellnessBad = { date: now.toISOString(), sleep: 1, energy: 1, soreness: 5, mood: 1, stress: 5 };
  const wellnessGood = { date: now.toISOString(), sleep: 5, energy: 5, soreness: 1, mood: 5, stress: 1 };
  const rBad  = estimateRecovery([baseSession], 1, wellnessBad, now);
  const rGood = estimateRecovery([baseSession], 1, wellnessGood, now);
  record("Wellness mauvais vs bon -> plages différentes",
    rBad.rangeHoursMax !== rGood.rangeHoursMax || rBad.rangeHoursMin !== rGood.rangeHoursMin,
    `mauvais=${rBad.rangeHoursMin}-${rBad.rangeHoursMax}h bon=${rGood.rangeHoursMin}-${rGood.rangeHoursMax}h`);
  record("Wellness mauvais -> borne haute >= wellness bon (récup plus longue)",
    rBad.rangeHoursMax >= rGood.rangeHoursMax, `mauvais=${rBad.rangeHoursMax}h bon=${rGood.rangeHoursMax}h`);
  record("Wellness mauvais -> facteurs listés (sommeil/courbatures/stress)", rBad.factors.length > 0, JSON.stringify(rBad.factors));
}

// ── 4. Wellness présent mais ANCIEN -> traité comme absent ─────────────────
{
  const now = new Date();
  const oldWellness = { date: new Date(now.getTime() - 5 * 86400000).toISOString(), sleep: 1, energy: 1, soreness: 5, mood: 1, stress: 5 };
  const rOld  = estimateRecovery([baseSession], 1, oldWellness, now);
  const rNone = estimateRecovery([baseSession], 1, null, now);
  record("Wellness ancien -> aucun facteur sommeil/courbatures/stress ajouté",
    !rOld.factors.some(f => /sommeil|courbature|stress/i.test(f.label)), JSON.stringify(rOld.factors));
  record("Wellness ancien -> confiance strictement inférieure à un wellness frais",
    rOld.confidenceScore < estimateRecovery([baseSession], 1, { date: now.toISOString(), sleep: 3, energy: 3, soreness: 3, mood: 3, stress: 3 }, now).confidenceScore);
  record("Wellness ancien vs absent -> confiance légèrement différente mais du même ordre",
    Math.abs(rOld.confidenceScore - rNone.confidenceScore) <= 15, `ancien=${rOld.confidenceScore} absent=${rNone.confidenceScore}`);
}

// ── 5. Aucune donnée subjective du tout -> fonctionne, confiance plus basse ──
{
  const now = new Date();
  const freshWellness = { date: now.toISOString(), sleep: 3, energy: 3, soreness: 3, mood: 3, stress: 3 };
  const rNoSubjective = estimateRecovery([baseSession], 1, null, now);
  const rWithWellness = estimateRecovery([baseSession], 1, freshWellness, now);
  record("Sans donnée subjective -> pas de crash, statut valide", rNoSubjective.status !== undefined, rNoSubjective.status);
  record("Sans donnée subjective -> confiance <= avec wellness frais",
    rNoSubjective.confidenceScore <= rWithWellness.confidenceScore,
    `sans=${rNoSubjective.confidenceScore} avec=${rWithWellness.confidenceScore}`);
}

// ── 6. Valeurs extrêmes et plafonds ─────────────────────────────────────────
{
  const now = new Date();
  const manyHardSessions = Array.from({ length: 6 }, (_, i) =>
    doneSession({ id: 100 + i, category: "sprint", durationMinutes: 120, rpe: 10, daysAgo: i })
  );
  const extremeWellness = { date: now.toISOString(), sleep: 1, energy: 1, soreness: 5, mood: 1, stress: 5 };
  const r = estimateRecovery(manyHardSessions, 1, extremeWellness, now);
  record("Valeurs extrêmes -> borne haute plafonnée à RECOVERY_HOURS_RANGE.sprint.max",
    r.rangeHoursMax <= RECOVERY_HOURS_RANGE.sprint.max, `max=${r.rangeHoursMax} plafond=${RECOVERY_HOURS_RANGE.sprint.max}`);
  record("Valeurs extrêmes -> confidenceScore reste dans [0,100]",
    r.confidenceScore >= 0 && r.confidenceScore <= 100, `score=${r.confidenceScore}`);
  record("Valeurs extrêmes -> rangeHoursMin <= rangeHoursMax (jamais inversé)",
    r.rangeHoursMin <= r.rangeHoursMax, `min=${r.rangeHoursMin} max=${r.rangeHoursMax}`);
}

// ── 7. Ne bloque jamais rien : la fonction ne renvoie qu'une estimation, pas un verdict "interdit" ──
{
  const r = estimateRecovery([baseSession], 1, null, new Date());
  const forbiddenKeys = ["blocked", "forbidden", "disallowed", "denied"];
  record("Aucune clé de blocage automatique dans le résultat", !forbiddenKeys.some(k => k in r), Object.keys(r).join(","));
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
if (failed.length) {
  console.error(`\n${failed.length} régression(s) détectée(s) :`);
  failed.forEach((f) => console.error(`  - ${f.name}${f.detail ? " : " + f.detail : ""}`));
  process.exit(1);
}
console.log("\nestimateRecovery() se comporte comme attendu sur tous les scénarios.");
process.exit(0);
