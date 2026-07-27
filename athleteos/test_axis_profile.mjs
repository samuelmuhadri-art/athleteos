#!/usr/bin/env node
// ============================================================
// AthleteOS — test_axis_profile.mjs
//
// Vérifie le profil de charge à 6 axes (tâche 18) — fonctions pures,
// aucune base de données requise, s'exécute directement avec `node`.
//
//   - somme et bornes des poids AXIS_WEIGHTS (chaque poids dans [0,1])
//   - reproductibilité : mêmes séances -> exactement le même score d'axe
//   - baseline insuffisante (<2 semaines) -> null, jamais un score inventé
//   - golden dataset : une séance connue donne la charge par axe attendue
//   - contributions : la séance la plus dure sur un axe ressort en premier
//
// Usage : node test_axis_profile.mjs
// ============================================================

import {
  LOAD_AXES, AXIS_WEIGHTS, computeSessionAxisLoads, getAthleteAxisProfile, getAxisTopContributors,
} from "./src/utils/loadAxes.js";

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

const AXIS_IDS = Object.keys(LOAD_AXES);

// ── 1. Bornes des poids : chaque poids catégorie->axe est dans [0,1] ───────
{
  let allInBounds = true;
  const offenders = [];
  for (const [cat, weights] of Object.entries(AXIS_WEIGHTS)) {
    for (const axis of AXIS_IDS) {
      const w = weights[axis];
      if (typeof w !== "number" || w < 0 || w > 1) { allInBounds = false; offenders.push(`${cat}.${axis}=${w}`); }
    }
  }
  record("Tous les poids AXIS_WEIGHTS sont dans [0,1]", allInBounds, offenders.join(", "));
}

// ── 2. Chaque catégorie couvre les 6 axes (pas de trou silencieux) ─────────
{
  const allComplete = Object.entries(AXIS_WEIGHTS).every(([, w]) => AXIS_IDS.every(a => typeof w[a] === "number"));
  record("Chaque catégorie a un poids défini pour les 6 axes", allComplete);
}

// ── Fixtures : séances d'un athlète sur plusieurs semaines ─────────────────
function session(id, week, category, durationMinutes, rpe, athleteId = 1) {
  return {
    id, week, category, durationMinutes, athleteIds: [athleteId],
    validations: [{ athleteId, rpe }],
  };
}

// ── 3. Golden dataset : charge par axe d'une séance connue ─────────────────
{
  // sprint, 60min, RPE 7 -> base = 420 ; neuromuscular weight = 1.0 -> round(420*1.0/10) = 42
  const loads = computeSessionAxisLoads(60, 7, "sprint");
  record("Golden dataset : sprint 60min RPE7 -> axe nerveux = 42", loads.neuromuscular === 42, JSON.stringify(loads));
  record("Golden dataset : sprint 60min RPE7 -> axe métabolique = 13 (0.3)", loads.metabolic === 13, JSON.stringify(loads));
}

// ── 4. Baseline insuffisante (<2 semaines) -> null, jamais un score inventé ──
{
  const oneWeek = [session(1, 10, "sprint", 60, 7)];
  const profile = getAthleteAxisProfile(1, oneWeek, 10);
  record("1 seule semaine de données -> profil null (pas de score inventé)", profile === null);
}
{
  const noSessions = [];
  const profile = getAthleteAxisProfile(1, noSessions, 10);
  record("Aucune séance -> profil null", profile === null);
}

// ── 5. Reproductibilité : mêmes séances -> exactement le même score ────────
{
  const sessions = [
    session(1, 8, "sprint", 60, 7), session(2, 8, "force", 45, 8),
    session(3, 9, "sprint", 60, 6), session(4, 9, "endurance", 50, 5),
    session(5, 10, "sprint", 70, 8), session(6, 10, "force", 40, 7),
  ];
  const profile1 = getAthleteAxisProfile(1, sessions, 10);
  const profile2 = getAthleteAxisProfile(1, sessions, 10);
  const sameScores = AXIS_IDS.every(a => profile1[a].score === profile2[a].score && profile1[a].acwr === profile2[a].acwr);
  record("Même entrée -> même sortie (reproductible)", sameScores, JSON.stringify({ p1: profile1?.neuromuscular, p2: profile2?.neuromuscular }));

  // ── 6. Qualité de données croît avec le nombre de semaines ───────────────
  record("3 semaines de données -> qualité 'faible'", profile1.neuromuscular.dataQuality === "faible",
    `weeksOfData=${profile1.neuromuscular.weeksOfData} quality=${profile1.neuromuscular.dataQuality}`);

  const manyWeeks = Array.from({ length: 9 }, (_, i) => session(100 + i, i + 1, "sprint", 60, 7));
  const bigProfile = getAthleteAxisProfile(1, manyWeeks, 9);
  record("9 semaines de données -> qualité 'élevée'", bigProfile.neuromuscular.dataQuality === "élevée",
    `weeksOfData=${bigProfile.neuromuscular.weeksOfData} quality=${bigProfile.neuromuscular.dataQuality}`);

  // ── 7. Baseline personnelle exposée (acute/chronic), pas juste un ratio ──
  record("Le profil expose acute ET chronic (comparaison à la baseline)",
    typeof profile1.neuromuscular.acute === "number" && typeof profile1.neuromuscular.chronic === "number",
    JSON.stringify({ acute: profile1.neuromuscular.acute, chronic: profile1.neuromuscular.chronic }));
}

// ── 8. Contributions : la séance la plus dure sur un axe ressort en premier ──
{
  const currentWeek = 10;
  const sessions = [
    session(1, currentWeek, "sprint", 30, 5),  // charge nerveuse modérée
    session(2, currentWeek, "sprint", 90, 9),  // charge nerveuse forte -> doit ressortir en premier
    session(3, currentWeek, "mobilite", 60, 3), // quasi nulle sur l'axe nerveux
  ];
  const top = getAxisTopContributors(1, sessions, "neuromuscular", currentWeek);
  record("Séances contributrices triées, la plus dure en premier", top.length > 0 && top[0].id === 2, JSON.stringify(top));
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
if (failed.length) {
  console.error(`\n${failed.length} régression(s) détectée(s) :`);
  failed.forEach((f) => console.error(`  - ${f.name}${f.detail ? " : " + f.detail : ""}`));
  process.exit(1);
}
console.log("\nProfil de charge à 6 axes : reproductible, borné, et documenté avec succès.");
process.exit(0);
