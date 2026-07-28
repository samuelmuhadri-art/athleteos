#!/usr/bin/env node
// ============================================================
// AthleteOS — test_discipline_registry.mjs
//
// Vérifie le registre central des disciplines (tâche 9) — fonctions
// pures, aucune base de données requise, s'exécute directement avec
// `node`.
//
//   - couverture sprint, demi-fond, sauts, lancers, combinées
//   - aucune collision d'ID/alias dans le registre (validateRegistry)
//   - alias historique normalisé ("100 m" -> "100m", y compris casse et
//     espaces multiples)
//   - discipline inconnue/personnalisée gérée sans crash (valeurs de
//     secours, jamais une exception)
//   - rendu des formats attendus (secondes, minutes:secondes, mètres, points)
//   - compat : getDiscHib/getDiscType (athlete/shared.js) et
//     discColor/COMBINE_EVENTS (perfsShared.js) délèguent bien au même
//     registre — pas de duplication qui pourrait diverger
//
// Usage : node test_discipline_registry.mjs
// ============================================================

import {
  DISCIPLINES, validateRegistry, resolveDisciplineId, getDiscipline,
  getDisciplineType, getDisciplineHib, getDisciplineUnit, getDisciplineMeasurementType,
  getDisciplineDecimals, getDisciplineInputFormat, getDisciplineColor, getDisciplineSubEvents,
  getAllDisciplineIds, MEASUREMENT_TYPE, INPUT_FORMAT,
} from "./src/domain/disciplines.js";
import { getDiscHib, getDiscType } from "./src/athlete/shared.js";
import { discColor, COMBINE_EVENTS } from "./src/athlete/views/perfsShared.js";

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

// ── 1. Aucune collision d'ID/alias dans le registre ─────────────────────────
{
  const issues = validateRegistry();
  record("Registre cohérent : aucune collision d'ID/alias, aucun champ manquant", issues.length === 0, JSON.stringify(issues));
}

// ── 2. Couverture par famille de disciplines ────────────────────────────────
{
  const sprint = getDiscipline("100m");
  record("100m (sprint) : chrono, plus petit = mieux", sprint.measurementType === MEASUREMENT_TYPE.TIME && sprint.higherIsBetter === false);

  const demiFond = getDiscipline("1500m");
  record("1500m (demi-fond) : chrono min:s, plus petit = mieux",
    demiFond.measurementType === MEASUREMENT_TYPE.TIME && demiFond.unit === "min:s" && demiFond.higherIsBetter === false);

  const saut = getDiscipline("Longueur");
  record("Longueur (saut) : distance, plus grand = mieux", saut.measurementType === MEASUREMENT_TYPE.DISTANCE && saut.higherIsBetter === true);

  const lancer = getDiscipline("Poids");
  record("Poids (lancer) : distance, plus grand = mieux", lancer.measurementType === MEASUREMENT_TYPE.DISTANCE && lancer.higherIsBetter === true);

  const combine1 = getDiscipline("Décathlon");
  record("Décathlon (combinée) : points, plus grand = mieux, 10 sous-épreuves",
    combine1.measurementType === MEASUREMENT_TYPE.POINTS && combine1.higherIsBetter === true && combine1.subEvents.length === 10);

  const combine2 = getDiscipline("Heptathlon");
  record("Heptathlon (combinée) : points, plus grand = mieux, 7 sous-épreuves",
    combine2.measurementType === MEASUREMENT_TYPE.POINTS && combine2.higherIsBetter === true && combine2.subEvents.length === 7);

  record("Au moins une discipline par famille (sprint/endurance/saut/lancer/combine)",
    ["sprint", "endurance", "saut", "lancer", "combine"].every(t => Object.values(DISCIPLINES).some(d => d.type === t)));
}

// ── 3. Alias historique normalisé ────────────────────────────────────────────
{
  record("'100 m' (espace) -> '100m'", resolveDisciplineId("100 m") === "100m");
  record("'100M' (casse) -> '100m'", resolveDisciplineId("100M") === "100m");
  record("'  100m  ' (espaces superflus) -> '100m'", resolveDisciplineId("  100m  ") === "100m");
  record("'Saut en longueur' -> 'Longueur'", resolveDisciplineId("Saut en longueur") === "Longueur");
  record("'Lancer de poids' -> 'Poids'", resolveDisciplineId("Lancer de poids") === "Poids");
  record("getDiscHib résout un alias comme le nom canonique",
    getDisciplineHib("100 m") === getDisciplineHib("100m"));
}

// ── 4. Discipline inconnue / personnalisée : jamais de crash ────────────────
{
  let threw = false;
  let fallback;
  try {
    fallback = {
      type: getDisciplineType("Épreuve Maison Inventée"),
      hib: getDisciplineHib("Épreuve Maison Inventée"),
      unit: getDisciplineUnit("Épreuve Maison Inventée"),
      color: getDisciplineColor("Épreuve Maison Inventée"),
      subEvents: getDisciplineSubEvents("Épreuve Maison Inventée"),
    };
  } catch { threw = true; }
  record("Discipline personnalisée -> aucune exception", !threw);
  record("Discipline personnalisée -> valeurs de secours cohérentes (pas null/undefined)",
    fallback && fallback.type != null && fallback.hib != null && fallback.unit != null && fallback.color != null);
  record("Discipline personnalisée -> resolveDisciplineId renvoie le texte tel quel (trim)",
    resolveDisciplineId("  Épreuve Maison Inventée  ") === "Épreuve Maison Inventée");
  record("Discipline personnalisée -> pas de sous-épreuves", fallback.subEvents === null);
  record("resolveDisciplineId(null) ne plante pas", resolveDisciplineId(null) === null);
  record("resolveDisciplineId('') ne plante pas", resolveDisciplineId("") === "");
}

// ── 5. Rendu des formats attendus ────────────────────────────────────────────
{
  record("100m -> inputFormat seconds, 2 décimales", getDisciplineInputFormat("100m") === INPUT_FORMAT.SECONDS && getDisciplineDecimals("100m") === 2);
  record("1500m -> inputFormat minutes", getDisciplineInputFormat("1500m") === INPUT_FORMAT.MINUTES);
  record("Longueur -> inputFormat meters", getDisciplineInputFormat("Longueur") === INPUT_FORMAT.METERS);
  record("Décathlon -> inputFormat points", getDisciplineInputFormat("Décathlon") === INPUT_FORMAT.POINTS);
  record("getAllDisciplineIds() couvre au moins 19 disciplines connues", getAllDisciplineIds().length >= 19, `count=${getAllDisciplineIds().length}`);
}

// ── 6. Compat : les façades existantes délèguent au même registre ──────────
{
  record("athlete/shared.js getDiscHib délègue au registre (100m)", getDiscHib("100m") === getDisciplineHib("100m"));
  record("athlete/shared.js getDiscType délègue au registre (Poids)", getDiscType("Poids") === getDisciplineType("Poids"));
  record("perfsShared.js discColor délègue au registre (100m)", discColor("100m") === getDisciplineColor("100m"));
  record("perfsShared.js COMBINE_EVENTS === registre (Décathlon)", JSON.stringify(COMBINE_EVENTS["Décathlon"]) === JSON.stringify(getDisciplineSubEvents("Décathlon")));
  record("Toutes les comparaisons passent par le même higherIsBetter (100m via 2 chemins différents)",
    getDiscHib("100 m") === getDisciplineHib("100m")); // alias résolu pareil des deux côtés
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
if (failed.length) {
  console.error(`\n${failed.length} régression(s) détectée(s) :`);
  failed.forEach((f) => console.error(`  - ${f.name}${f.detail ? " : " + f.detail : ""}`));
  process.exit(1);
}
console.log("\nRegistre central des disciplines : cohérent sur tous les scénarios.");
process.exit(0);
