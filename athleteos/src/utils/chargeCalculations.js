// ============================================================
// AthleteOS — src/utils/chargeCalculations.js
//
// MODÈLE SCIENTIFIQUE DE SUIVI DE CHARGE — VERSION 2.0
//
// ═══════════════════════════════════════════════════════════
// RÉFÉRENCES SCIENTIFIQUES
// ═══════════════════════════════════════════════════════════
//
// [1] Foster C, Florhaug JA, Franklin J, et al. (2001).
//     "A New Approach to Monitoring Exercise Training."
//     Journal of Strength and Conditioning Research, 15(1), 109-115.
//     → Base de la méthode session-RPE (Durée × RPE)
//
// [2] Foster C. (1998).
//     "Monitoring training in athletes with reference to overtraining syndrome."
//     Medicine & Science in Sports & Exercise, 30(7), 1164-1168.
//     → Monotonie et Contrainte d'entraînement
//
// [3] Gabbett TJ. (2016).
//     "The training-injury prevention paradox: should athletes be training
//     smarter and harder?"
//     British Journal of Sports Medicine, 50(5), 273-280.
//     → Référence historique ACWR ; AthleteOS le classe désormais comme expérimental.
//
// [4] Williams S, Booton T, Watson M, et al. (2017).
//     "Monitoring of athlete training loads with injury risk in mind."
//     International Journal of Sports Physiology and Performance.
//     → EWMA supérieur à la moyenne mobile simple
//
// [5] Saw AE, Main LC, Gastin PB. (2016).
//     "Monitoring the athlete training response: subjective self-report
//     measures trump commonly used objective measures."
//     British Journal of Sports Medicine, 50(5), 281-291.
//     → Questionnaire wellness = mesure la plus sensible et fiable
//
// [6] McLean BD, Coutts AJ, Kelly V, et al. (2010).
//     "Neuromuscular, endocrine, and perceptual fatigue responses during
//     different length between-match microcycles in professional rugby league."
//     International Journal of Sports Physiology and Performance.
//     → Mesures subjectives ; le questionnaire interne AthleteOS n'est pas le Hooper Index.
//
// [7] Hasegawa T, et al. (2024).
//     "Effects of high-intensity sprint exercise on neuromuscular function
//     in sprinters: the countermovement jump as a fatigue assessment tool."
//     PeerJ 12:e17443.
//     → Récupération neuromusculaire sprint : 48-72h
//
// [8] Borg G. (1998).
//     Borg's Perceived Exertion and Pain Scales. Human Kinetics.
//     → Échelle RPE CR10 (0-10)
//
// ⚠️  TRANSPARENCE :
//     La charge globale ne contient plus de coefficient de discipline.
//     L'ACWR n'est jamais utilisé comme prédicteur individuel de blessure.
//
// Les constantes (LOAD_COEFFICIENTS, RECOVERY_HOURS) et les fonctions de
// calcul de base (EWMA, monotonie/contrainte, wellness, récupération) vivent
// dans trainingLoad.js — seule source de vérité — et sont ré-exportées ici
// pour compatibilité avec les modules qui les importent depuis ce fichier.
// ============================================================

export {
  LOAD_COEFFICIENTS,
  RECOVERY_HOURS,
  RECOVERY_HOURS_RANGE,
  computeEWMA,
  computeMonotonyAndStrain,
  computeWellnessScore,
  estimateRecovery,
  computeSessionLoad,
  getRPELabel,
} from "./trainingLoad.js";

import {
  computeEWMA,
  computeMonotonyAndStrain,
  computeWellnessScore,
  estimateRecovery,
  extractDailyLoads,
  computeLoadWindows,
} from "./trainingLoad.js";

// ─── Calcul des métriques complètes pour un athlète à une semaine donnée ──────
// Combine : ACWR (EWMA), monotonie, contrainte, wellness, récupération
//
// @param athleteId  : number
// @param weeklyCharge : [{ athleteId, week, rawLoad }]
// @param currentWeek  : number (semaine ISO courante)
// @param wellnessData : [{ date, sleep, energy, soreness, mood, stress }] (optionnel)
// @param sessions     : array de séances (optionnel, pour récupération)
export function getAthleteMetricsForWeek(athleteId, weeklyCharge, currentWeek, wellnessData = [], sessions = []) {
  const myCharge = weeklyCharge
    .filter(w => w.athleteId === athleteId)
    .filter(w => currentWeek == null || w.week <= currentWeek)
    .sort((a, b) => a.week - b.week);
  const dailyLoads = extractDailyLoads(athleteId, myCharge, currentWeek);
  const { acute, chronic, acwr, ewmaHistory, observedDays, status: acwrStatus } = computeEWMA(dailyLoads);
  const loadWindows = computeLoadWindows(dailyLoads);
  const { monotony, strain, status: monotonyStatus } = computeMonotonyAndStrain(
    dailyLoads.slice(-7).map((point) => point.load),
  );

  // ── Wellness [5][6] ────────────────────────────────────────────────────────
  // Prend le dernier questionnaire disponible (7 derniers jours)
  const recentWellness = wellnessData
    .filter(w => w.athleteId === athleteId || !w.athleteId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0] ?? null;
  const wellnessScore = computeWellnessScore(recentWellness);

  // Règle de programmation du club, pas estimation physiologique.
  const recovery = estimateRecovery(sessions, athleteId, recentWellness);
  const readiness = wellnessScore;
  const fatigue = wellnessScore == null ? null : 100 - wellnessScore;

  return {
    acute, chronic, acwr, acwrStatus, acwrExperimental: true, observedDays,
    ewmaHistory,
    ...loadWindows,
    monotony, strain, monotonyStatus,
    wellnessScore,
    recovery,
    fatigue,
    forme: null,
    readiness,
    recuperation: null,
    risque: null,
    hasDailyLoadData: dailyLoads.length > 0,
  };
}

// ─── getStatusLabel (inchangé) ────────────────────────────────────────────────
export function getStatusLabel(readiness, fatigue, acwr) {
  void acwr;
  if (readiness == null) return { label: "Données à compléter", dot: "⚪", color: "#8A9B90" };
  if (readiness >= 75) return { label: "Ressenti favorable", dot: "🟢", color: "#1D9E75" };
  if (readiness >= 50) return { label: "Ressenti intermédiaire", dot: "🟡", color: "#EF9F27" };
  if (fatigue != null && fatigue >= 75) return { label: "Ressenti difficile", dot: "🟠", color: "#E24B4A" };
  return { label: "Ressenti à discuter", dot: "🔵", color: "#378ADD" };
}
// ─── computeChargeChartData ───────────────────────────────────────────────────
// Prépare les données du graphique charge vs forme sur les 12 dernières semaines.
export function computeChargeChartData(athleteId, weeklyCharge) {
  const myCharge = weeklyCharge
    .filter(w => w.athleteId === athleteId)
    .sort((a, b) => a.week - b.week)
    .slice(-12);

  if (!myCharge.length) return [];

  return myCharge.map((week) => ({ label: `S${week.week}`, rawLoad: week.rawLoad, forme: null, fatigue: null }));
}

// ─── generateContextAnalysis ──────────────────────────────────────────────────
// Génère des phrases d'analyse contextuelle à partir des métriques et de la prochaine compétition.
export function generateContextAnalysis(metrics, nextComp) {
  const { load7, load28, variationPercent, monotony, monotonyStatus, recovery } = metrics;
  const lines = [];

  if (load7 == null || load28 == null) {
    lines.push("ℹ️ Historique quotidien incomplet : les charges 7 et 28 jours ne sont pas encore comparables.");
  } else {
    const variation = variationPercent == null ? "" : ` · variation descriptive ${variationPercent >= 0 ? "+" : ""}${variationPercent}%`;
    lines.push(`Charge observée : ${load7} u sur 7 jours et ${load28} u sur 28 jours${variation}.`);
  }

  if (monotonyStatus === "undefined_zero_variance") {
    lines.push("Monotonie non définie : les sept charges quotidiennes sont identiques.");
  } else if (monotony != null) {
    lines.push(`Monotonie descriptive sur 7 jours : ${monotony.toFixed(2)}.`);
  }

  if (recovery?.status === "insufficient_data") {
    lines.push("ℹ️ Pas assez de séances récentes pour estimer la récupération.");
  } else if (recovery?.status === "spacing_active" || recovery?.status === "spacing_transition") {
    lines.push(`Règle de programmation : encore ${recovery.rangeHoursMin}–${recovery.rangeHoursMax} h dans la fenêtre configurée. Ce n'est pas une estimation physiologique.`);
  } else if (recovery?.status === "window_elapsed") {
    lines.push("La fenêtre d'espacement configurée est terminée ; cela ne prouve pas une récupération complète.");
  }

  if (nextComp) {
    const days = Math.round((new Date(nextComp.date) - new Date()) / (1000 * 60 * 60 * 24));
    if (days <= 3)       lines.push("🏟️ Compétition dans " + days + "j (" + nextComp.name + ") : activation, réduire la charge.");
    else if (days <= 7)  lines.push("🏟️ Compétition dans " + days + "j (" + nextComp.name + ") : semaine d'affûtage, baisser le volume.");
    else if (days <= 14) lines.push("🏟️ Compétition dans " + days + "j (" + nextComp.name + ") : maintenir charge, soigner la qualité.");
  }

  return lines.length ? lines : ["Pas assez de données pour une analyse contextuelle."];
}

// ─── computePerformanceStability ──────────────────────────────────────────────
// Mesure la régularité des performances via le coefficient de variation.
// Score 0-100 (100 = très régulier). Minimum 3 points requis.
export function computePerformanceStability(performanceHistory) {
  const values = (performanceHistory ?? [])
    .map(p => parseFloat(p.value))
    .filter(v => !isNaN(v) && v > 0);

  if (values.length < 3) return null;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd   = Math.sqrt(values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length);
  const cv   = mean > 0 ? (sd / mean) * 100 : 0;
  return Math.round(Math.max(0, Math.min(100, 100 - cv * 5)));
}
