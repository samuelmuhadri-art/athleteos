#!/usr/bin/env node
// ============================================================
// AthleteOS — test_perf_engine.mjs
//
// Vérifie le moteur central de comparaison de performances (tâche 11) —
// fonctions pures, aucune base de données requise, s'exécute directement
// avec `node`.
//
//   - 100m, 1500m, longueur, poids, décathlon : le sens est toujours
//     correct pour chaque discipline
//   - égalité et précision différente ("11.20" vs "11.2")
//   - objectif déjà atteint, non atteint, et incohérent (données absentes)
//   - isNewRecord (competitionsShared.js) avec la discipline correcte,
//     y compris le cas qui trompait l'ancienne heuristique par format
//     (un lancer de poids "14.20" pris pour un chrono)
//
// Usage : node test_perf_engine.mjs
// ============================================================

import {
  parsePerf, getDiscHib, isBetterOrEqual, compareValues, pctOfReference,
} from "./src/athlete/shared.js";
import { isNewRecord } from "./src/modules/competitionsShared.js";

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

// ── 1. parsePerf : valeur numérique correcte, jamais de sens deviné ────────
{
  record("parsePerf('11.20') -> 11.2", parsePerf("11.20").value === 11.2);
  record("parsePerf('4:32') -> 272 (secondes)", parsePerf("4:32").value === 272);
  record("parsePerf('7.60m') -> 7.6", parsePerf("7.60m").value === 7.6);
  record("parsePerf('14.20') (poids, sans unité) -> 14.2, pas de sens attaché", parsePerf("14.20").value === 14.2);
  record("parsePerf(null) -> value null", parsePerf(null).value === null);
  record("parsePerf ne renvoie plus de champ hib/higherIsBetter", !("hib" in parsePerf("11.20")) && !("higherIsBetter" in parsePerf("11.20")));
}

// ── 2. getDiscHib : sens correct par discipline ─────────────────────────────
{
  record("100m -> hib false (chrono, plus petit = mieux)", getDiscHib("100m") === false);
  record("1500m -> hib false (chrono)", getDiscHib("1500m") === false);
  record("Longueur -> hib true (distance, plus grand = mieux)", getDiscHib("Longueur") === true);
  record("Poids -> hib true (distance)", getDiscHib("Poids") === true);
  record("Décathlon -> hib true (points)", getDiscHib("Décathlon") === true);
}

// ── 3. isBetterOrEqual : DoD "11.00 meilleur que 11.20 sur 100m partout" ───
{
  record("100m : 11.00 est meilleur que 11.20", isBetterOrEqual(11.00, 11.20, "100m") === true);
  record("100m : 11.20 n'est PAS meilleur que 11.00", isBetterOrEqual(11.20, 11.00, "100m") === false);
  record("Longueur : 7.60 est meilleur que 7.20 (distance supérieure reste meilleure)", isBetterOrEqual(7.60, 7.20, "Longueur") === true);
  record("Longueur : 7.20 n'est PAS meilleur que 7.60", isBetterOrEqual(7.20, 7.60, "Longueur") === false);
  record("Poids : 14.50 est meilleur que 14.20", isBetterOrEqual(14.50, 14.20, "Poids") === true);
  record("Décathlon : 7800 pts est meilleur que 7500 pts", isBetterOrEqual(7800, 7500, "Décathlon") === true);
}

// ── 4. Égalité et précision différente ──────────────────────────────────────
{
  record("100m : 11.20 égal à 11.20 -> isBetterOrEqual true", isBetterOrEqual(11.20, 11.20, "100m") === true);
  record("Précision différente : parsePerf('11.2') === parsePerf('11.20')", parsePerf("11.2").value === parsePerf("11.20").value);
}

// ── 5. compareValues : tri correct pour un classement ───────────────────────
{
  const sprintTimes = [11.80, 10.95, 11.20];
  const sorted100m = [...sprintTimes].sort((a, b) => compareValues(a, b, "100m"));
  record("Classement 100m trié du plus rapide au plus lent", sorted100m[0] === 10.95 && sorted100m[2] === 11.80, JSON.stringify(sorted100m));

  const jumps = [6.20, 7.10, 6.80];
  const sortedLongueur = [...jumps].sort((a, b) => compareValues(a, b, "Longueur"));
  record("Classement Longueur trié du plus loin au moins loin", sortedLongueur[0] === 7.10 && sortedLongueur[2] === 6.20, JSON.stringify(sortedLongueur));
}

// ── 6. pctOfReference : % du PR, sens correct par discipline ───────────────
{
  // 100m (hib false) : SB plus lent que le PR -> < 100%
  const pct100 = pctOfReference(11.50, 11.00, "100m"); // SB=11.50 (moins bon), PR=11.00
  record("100m : SB plus lent que PR -> pct < 100%", pct100 !== null && pct100 < 100, `pct=${pct100}`);
  // Longueur (hib true) : SB plus court que le PR -> < 100%
  const pctLong = pctOfReference(6.50, 7.00, "Longueur");
  record("Longueur : SB plus court que PR -> pct < 100%", pctLong !== null && pctLong < 100, `pct=${pctLong}`);
  // SB === PR -> 100% pile
  record("SB égal au PR -> 100%", pctOfReference(11.00, 11.00, "100m") === 100);
}

// ── 7. Objectifs : atteint, non atteint, incohérent (via pctOfReference) ───
{
  // 100m : objectif plus rapide que le PR, pas encore atteint
  const pctNotYet = pctOfReference(12.00, 11.00, "100m"); // PR=12.00, cible=11.00 (plus rapide)
  record("Objectif chronométré non atteint -> pct < 100% (pas de faux 100%+)", pctNotYet !== null && pctNotYet < 100, `pct=${pctNotYet}`);
  // 100m : objectif déjà dépassé (plus lent que le PR actuel)
  const pctAchieved = pctOfReference(11.00, 13.00, "100m"); // PR=11.00 (déjà largement sous la cible 13.00)
  record("Objectif chronométré déjà dépassé -> plafonné à 100%", pctAchieved === 100, `pct=${pctAchieved}`);
  // Longueur : objectif non atteint
  const pctLongNotYet = pctOfReference(6.00, 7.00, "Longueur");
  record("Objectif distance non atteint -> pct < 100%", pctLongNotYet !== null && pctLongNotYet < 100, `pct=${pctLongNotYet}`);
  // Incohérent : pas de PR connu -> null, pas un chiffre inventé
  record("Objectif incohérent (PR absent) -> null, pas un chiffre inventé", pctOfReference(null, 11.00, "100m") === null);
  record("Objectif incohérent (cible absente) -> null", pctOfReference(11.00, null, "100m") === null);
}

// ── 8. isNewRecord (competitionsShared.js) — y compris le piège "poids sans unité" ──
{
  record("100m : 10.95 bat un PR de 11.20", isNewRecord("10.95", "11.20", "100m") === true);
  record("100m : 11.40 NE bat PAS un PR de 11.20", isNewRecord("11.40", "11.20", "100m") === false);
  record("Poids : '14.20' (sans unité) bat un PR de '13.80' — piège de l'ancienne heuristique par format",
    isNewRecord("14.20", "13.80", "Poids") === true);
  record("Poids : '13.50' (sans unité) NE bat PAS un PR de '13.80'", isNewRecord("13.50", "13.80", "Poids") === false);
  record("Pas de PR existant -> toujours un nouveau record", isNewRecord("11.20", null, "100m") === true);
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
if (failed.length) {
  console.error(`\n${failed.length} régression(s) détectée(s) :`);
  failed.forEach((f) => console.error(`  - ${f.name}${f.detail ? " : " + f.detail : ""}`));
  process.exit(1);
}
console.log("\nMoteur central de comparaison de performances : correct sur tous les scénarios.");
process.exit(0);
