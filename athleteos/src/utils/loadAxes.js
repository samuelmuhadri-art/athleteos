// ============================================================
// AthleteOS — src/utils/loadAxes.js
//
// "Profil de charge athlétique" — décompose la charge d'entraînement
// (déjà calculée par trainingLoad.js selon la méthode session-RPE) sur
// 6 axes physiologiques au lieu d'un seul chiffre agrégé. Objectif :
// repérer PAR TYPE DE CONTRAINTE ce qui est inhabituel pour un athlète
// donné — pas seulement "sa charge totale est haute", mais "c'est sa
// charge élastique qui sort de l'ordinaire cette semaine, pas le reste".
//
// Volontairement 100% côté client, calculé à partir des `sessions` déjà
// chargées par les vues existantes (Dashboard, AthleteProfile,
// AthleteDashboard) — aucune migration, aucune nouvelle requête. La vue
// SQL weekly_charge (charge agrégée globale, utilisée pour l'ACWR/
// readiness/forme historiques) n'est pas touchée : les 6 axes sont un
// raffinement affiché en plus, pas un remplacement.
//
// Le "score" par axe reprend le principe ACWR déjà utilisé partout
// ailleurs dans l'app (charge aiguë récente / charge chronique
// habituelle, via la même EWMA que trainingLoad.js) — appliqué à
// chaque axe séparément plutôt qu'à la charge totale. C'est très
// exactement la "capacité habituelle de CET athlète", pas une moyenne
// de population.
//
// ⚠️ Comme LOAD_COEFFICIENTS dans trainingLoad.js, la table AXIS_WEIGHTS
// ci-dessous est une CONVENTION DE COACHING AthleteOS. Qu'un sprint et
// un bond ne sollicitent pas les mêmes structures est établi en
// sciences du sport ; les poids numériques exacts par catégorie
// n'existent dans aucune publication spécifique — ils sont calibrables
// par le coach, pas un standard validé.
// ============================================================

import { computeEWMA } from "./trainingLoad";

export const LOAD_AXES = {
  neuromuscular: {
    label: "Nerveux", nounPhrase: "neuromusculaire",
    what: "Vitesse et force maximale : sprints, départs, charges lourdes.",
    color: "#E24B4A",
  },
  elastic: {
    label: "Élastique", nounPhrase: "élastique",
    what: "Bonds et rebonds : la capacité de tes tendons à encaisser des chocs répétés.",
    color: "#EF9F27",
  },
  metabolic: {
    label: "Métabolique", nounPhrase: "métabolique",
    what: "Ton endurance : la capacité de ton corps à tenir un effort long.",
    color: "#378ADD",
  },
  muscular: {
    label: "Musculaire", nounPhrase: "musculaire",
    what: "La fatigue de tes muscles après l'effort — courbatures, musculation.",
    color: "#A855F7",
  },
  technical: {
    label: "Technique", nounPhrase: "technique",
    what: "L'apprentissage d'un geste précis — haies, perche, sauts.",
    color: "#14B8A6",
  },
  mental: {
    label: "Mental", nounPhrase: "mentale",
    what: "Le stress et la concentration liés à la compétition ou à l'intensité.",
    color: "#EC4899",
  },
};

const AXIS_IDS = Object.keys(LOAD_AXES);

// Poids relatif (0-1) de chaque catégorie de séance sur chacun des 6 axes.
export const AXIS_WEIGHTS = {
  sprint:       { neuromuscular: 1.0,  elastic: 0.7,  metabolic: 0.3, muscular: 0.3, technical: 0.5, mental: 0.4 },
  haies:        { neuromuscular: 0.9,  elastic: 0.8,  metabolic: 0.3, muscular: 0.3, technical: 0.8, mental: 0.5 },
  force:        { neuromuscular: 0.6,  elastic: 0.3,  metabolic: 0.3, muscular: 1.0, technical: 0.3, mental: 0.3 },
  saut:         { neuromuscular: 0.8,  elastic: 1.0,  metabolic: 0.3, muscular: 0.4, technical: 0.8, mental: 0.5 },
  lancer:       { neuromuscular: 0.7,  elastic: 0.5,  metabolic: 0.2, muscular: 0.7, technical: 0.9, mental: 0.4 },
  endurance:    { neuromuscular: 0.2,  elastic: 0.2,  metabolic: 1.0, muscular: 0.3, technical: 0.2, mental: 0.3 },
  technique:    { neuromuscular: 0.3,  elastic: 0.3,  metabolic: 0.2, muscular: 0.2, technical: 1.0, mental: 0.3 },
  mobilite:     { neuromuscular: 0.1,  elastic: 0.2,  metabolic: 0.1, muscular: 0.1, technical: 0.2, mental: 0.2 },
  recuperation: { neuromuscular: 0.05, elastic: 0.05, metabolic: 0.1, muscular: 0.05, technical: 0.05, mental: 0.1 },
};

/** Charge d'une séance ventilée sur les 6 axes (même base durée × RPE que computeSessionLoad). */
export function computeSessionAxisLoads(durationMinutes, rpe, category) {
  if (durationMinutes == null || rpe == null) return null;
  const base    = durationMinutes * rpe;
  const weights = AXIS_WEIGHTS[category] ?? AXIS_WEIGHTS.technique;
  const loads = {};
  AXIS_IDS.forEach(axis => { loads[axis] = Math.round((base * (weights[axis] ?? 0)) / 10); });
  return loads;
}

/** Charge hebdomadaire par axe pour un athlète, à partir de ses séances (RPE renseigné uniquement). */
export function computeWeeklyAxisLoads(athleteId, sessions) {
  const byWeek = new Map();
  (sessions ?? []).forEach(s => {
    if (!s.athleteIds?.includes(athleteId)) return;
    const v = s.validations?.find(x => x.athleteId === athleteId);
    if (v?.rpe == null) return;
    const loads = computeSessionAxisLoads(s.durationMinutes, v.rpe, s.category);
    if (!loads) return;
    if (!byWeek.has(s.week)) byWeek.set(s.week, Object.fromEntries(AXIS_IDS.map(a => [a, 0])));
    const acc = byWeek.get(s.week);
    AXIS_IDS.forEach(axis => { acc[axis] += loads[axis]; });
  });
  return [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([week, loads]) => ({ week, loads }));
}

// Score 0-100 centré sur 50 = "normal" (ratio aigu/chronique ≈ 1). Mêmes
// seuils que l'ACWR global déjà utilisé partout dans l'app (0.8 / 1.3 / 1.5)
// pour rester cohérent : 50±10 = optimal, >65 = élevé, >75 = très élevé,
// <40 = faible.
export function axisScoreFromAcwr(acwr) {
  return Math.max(0, Math.min(100, Math.round(50 + (acwr - 1) * 50)));
}

export function axisStatus(score) {
  if (score > 75) return { label: "Très élevé", color: "#E24B4A" };
  if (score > 65) return { label: "Élevé",       color: "#EF9F27" };
  if (score >= 40) return { label: "Normal",     color: "#1D9E75" };
  return                  { label: "Faible",     color: "#378ADD" };
}

/**
 * Profil de charge complet d'un athlète : pour chacun des 6 axes, le
 * ratio aigu/chronique (l'équivalent ACWR par axe — "capacité habituelle
 * de cet athlète") et un score 0-100 + statut en langage clair pour
 * l'affichage. Retourne null tant qu'il n'y a pas au moins 2 semaines de
 * données (comme les autres métriques de l'app, plus fiable avec l'historique).
 */
export function getAthleteAxisProfile(athleteId, sessions, currentWeek) {
  const weekly = computeWeeklyAxisLoads(athleteId, sessions).filter(w => w.week <= currentWeek);
  if (weekly.length < 2) return null;

  const profile = {};
  AXIS_IDS.forEach(axis => {
    const dailyLoads = weekly.map(w => ({ date: `W${w.week}`, load: w.loads[axis] }));
    const { acwr } = computeEWMA(dailyLoads);
    const score = axisScoreFromAcwr(acwr);
    profile[axis] = { acwr, score, ...axisStatus(score) };
  });
  return profile;
}
