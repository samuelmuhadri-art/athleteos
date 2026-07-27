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
//     → ACWR, zone optimale 0.8-1.3, paradoxe charge/blessure
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
//     → Questionnaire Hooper : sommeil, énergie, courbatures, stress
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
//     Les coefficients par catégorie (LOAD_COEFFICIENTS) et les
//     pondérations des scores dérivés (readiness, forme, récupération)
//     sont des CONVENTIONS DE COACHING, pas des valeurs publiées.
//     Ils sont explicitement séparés des formules scientifiques validées.
//
// Les constantes (LOAD_COEFFICIENTS, RECOVERY_HOURS) et les fonctions de
// calcul de base (EWMA, monotonie/contrainte, wellness, récupération) vivent
// dans trainingLoad.js — seule source de vérité — et sont ré-exportées ici
// pour compatibilité avec les modules qui les importent depuis ce fichier.
// ============================================================

export {
  LOAD_COEFFICIENTS,
  RECOVERY_HOURS,
  computeEWMA,
  computeMonotonyAndStrain,
  computeWellnessScore,
  computeRecoveryStatus,
  computeSessionLoad,
  getRPELabel,
} from "./trainingLoad.js";

import {
  computeEWMA,
  computeMonotonyAndStrain,
  computeWellnessScore,
  computeRecoveryStatus,
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
    .sort((a, b) => a.week - b.week);

  if (!myCharge.length) {
    return {
      acute: 0, chronic: 0, acwr: 1.0,
      fatigue: 0, forme: 0, readiness: 0, recuperation: 0, risque: 0,
      monotony: 0, strain: 0,
      wellnessScore: null,
      recovery: { hoursRemaining: 0, fullyRecovered: true, lastSession: null },
      ewmaHistory: [],
    };
  }

  // ── Conversion semaines → charges journalières pour EWMA ──────────────────
  // On approxime : 1 semaine = 1 point de données (charge hebdomadaire)
  // Pour un calcul journalier précis, il faudrait des données par séance
  const dailyLoads = myCharge.map(w => ({
    date: `W${w.week}`,
    load: w.rawLoad,
  }));

  // ── ACWR via EWMA [4] ──────────────────────────────────────────────────────
  const { acute, chronic, acwr, ewmaHistory } = computeEWMA(dailyLoads);

  // ── Monotonie et Contrainte [2] ────────────────────────────────────────────
  // Sur les 4 dernières semaines
  const last4Weeks = myCharge.slice(-4).map(w => w.rawLoad);
  const { monotony, strain } = computeMonotonyAndStrain(last4Weeks);

  // ── Wellness [5][6] ────────────────────────────────────────────────────────
  // Prend le dernier questionnaire disponible (7 derniers jours)
  const recentWellness = wellnessData
    .filter(w => w.athleteId === athleteId || !w.athleteId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0] ?? null;
  const wellnessScore = computeWellnessScore(recentWellness);

  // ── Récupération neuromusculaire [7] ──────────────────────────────────────
  const recovery = computeRecoveryStatus(sessions, athleteId);

  // ── Scores dérivés (CONVENTION COACHING — non scientifique) ───────────────
  // Ces formules sont des proxies raisonnables mais leurs pondérations
  // ne sont pas issues de publications scientifiques.
  const acwrNorm = Math.max(0, Math.min(100, (1 - Math.abs(acwr - 1.05)) * 100));

  // Fatigue : basée sur l'ACWR et la charge aiguë relative
  const rawFatigue = Math.min(100, (acwr > 1.0 ? (acwr - 1.0) * 120 : 0) + (acute / Math.max(chronic, 1) - 0.8) * 30);
  const fatigue    = Math.max(0, Math.round(rawFatigue));

  // Forme : basée sur la charge chronique (fitness) et l'EWMA
  const maxChronicKnown = Math.max(...myCharge.map(w => w.rawLoad), 1);
  const forme = Math.round(Math.min(100, (chronic / maxChronicKnown) * 100));

  // Récupération (score) : inversement proportionnel aux heures restantes
  const maxRecoveryHours = 72;
  const recuperation = Math.round(Math.max(0, (1 - recovery.hoursRemaining / maxRecoveryHours) * 100));

  // Readiness : combine forme, récupération, wellness et ACWR [5]
  // Si wellness disponible → intégré à 25%, sinon réparti sur les autres
  let readiness;
  if (wellnessScore !== null) {
    readiness = Math.round(
      forme        * 0.30 +
      recuperation * 0.25 +
      wellnessScore * 0.25 +
      acwrNorm     * 0.20
    );
  } else {
    readiness = Math.round(
      forme        * 0.40 +
      recuperation * 0.35 +
      acwrNorm     * 0.25
    );
  }

  // Signal de charge (nommé "risque" en interne, affiché "Signal de charge"
  // — voir athlete/shared.js) : combine ACWR élevé + monotonie élevée +
  // récupération insuffisante. Un signal composite, pas une probabilité de
  // blessure mesurée ou validée.
  const acwrRisk    = acwr > 1.3 ? Math.min(100, (acwr - 1.3) * 200) : acwr < 0.8 ? 10 : 0;
  const monotonyRisk = monotony > 2 ? Math.min(50, (monotony - 2) * 25) : 0;
  const recoveryRisk = recovery.hoursRemaining > 48 ? 20 : 0;
  const risque = Math.round(Math.min(100, acwrRisk + monotonyRisk + recoveryRisk));

  return {
    // Métriques scientifiques [1][3][4]
    acute,
    chronic,
    acwr,
    ewmaHistory,
    // Métriques Foster [2]
    monotony,
    strain,
    // Wellness [5][6]
    wellnessScore,
    // Récupération [7]
    recovery,
    // Scores dérivés (convention coaching)
    fatigue:      Math.max(0, Math.min(100, fatigue)),
    forme:        Math.max(0, Math.min(100, forme)),
    readiness:    Math.max(0, Math.min(100, readiness)),
    recuperation: Math.max(0, Math.min(100, recuperation)),
    risque:       Math.max(0, Math.min(100, risque)),
  };
}

// ─── getStatusLabel (inchangé) ────────────────────────────────────────────────
export function getStatusLabel(readiness, fatigue, acwr) {
  if (acwr > 1.5)         return { label: "Surcharge critique", dot: "🔴", color: "#E24B4A" };
  if (acwr > 1.3)         return { label: "Surcharge",          dot: "🟠", color: "#EF9F27" };
  if (fatigue > 75)       return { label: "Fatigue élevée",     dot: "🟡", color: "#EF9F27" };
  if (readiness >= 75)    return { label: "Optimal",            dot: "🟢", color: "#1D9E75" };
  if (readiness >= 55)    return { label: "Modéré",             dot: "🟡", color: "#EF9F27" };
  if (readiness >= 35)    return { label: "Fatigué",            dot: "🟠", color: "#EF9F27" };
  return                         { label: "Récupération",       dot: "🔵", color: "#378ADD" };
}
// ─── computeChargeChartData ───────────────────────────────────────────────────
// Prépare les données du graphique charge vs forme sur les 12 dernières semaines.
export function computeChargeChartData(athleteId, weeklyCharge) {
  const myCharge = weeklyCharge
    .filter(w => w.athleteId === athleteId)
    .sort((a, b) => a.week - b.week)
    .slice(-12);

  if (!myCharge.length) return [];

  const dailyLoads = myCharge.map(w => ({ date: `W${w.week}`, load: w.rawLoad }));
  const { ewmaHistory } = computeEWMA(dailyLoads);
  const maxLoad = Math.max(...myCharge.map(w => w.rawLoad), 1);

  return myCharge.map((w, i) => {
    const ewma = ewmaHistory[i] ?? { acute: 0, chronic: 0 };
    const acwr = ewma.chronic > 0 ? ewma.acute / ewma.chronic : 1.0;
    const fatigue = Math.max(0, Math.round(Math.min(100, acwr > 1.0 ? (acwr - 1.0) * 120 : 0)));
    const forme   = Math.round(Math.min(100, (ewma.chronic / maxLoad) * 100));
    return { label: `S${w.week}`, rawLoad: w.rawLoad, forme, fatigue };
  });
}

// ─── generateContextAnalysis ──────────────────────────────────────────────────
// Génère des phrases d'analyse contextuelle à partir des métriques et de la prochaine compétition.
export function generateContextAnalysis(metrics, nextComp) {
  const { acwr, fatigue, readiness, monotony, recovery } = metrics;
  const lines = [];

  if (acwr > 1.5)       lines.push("⚠️ ACWR très élevé (" + acwr.toFixed(2) + ") : hors de la zone associée à un risque plus faible dans la littérature (Gabbett 2016). Envisage de réduire la charge, à valider avec l'athlète.");
  else if (acwr > 1.3)  lines.push("🟠 ACWR élevé (" + acwr.toFixed(2) + ") : zone de surcharge aiguë. Surveiller la récupération.");
  else if (acwr < 0.8)  lines.push("🔵 ACWR faible (" + acwr.toFixed(2) + ") : sous-charge relative. Augmentation progressive possible.");
  else                  lines.push("🟢 ACWR optimal (" + acwr.toFixed(2) + ") : balance charge aiguë/chronique dans la zone cible (0.8–1.3).");

  if (fatigue > 75)       lines.push("🔴 Fatigue élevée (" + fatigue + "/100) : prévoir récupération ou repos.");
  else if (fatigue > 50)  lines.push("🟡 Fatigue modérée (" + fatigue + "/100) : surveiller l'accumulation.");
  else                    lines.push("✅ Fatigue bien gérée (" + fatigue + "/100).");

  if (readiness >= 75)     lines.push("🌟 Readiness optimal (" + readiness + "/100) : prêt pour haute intensité.");
  else if (readiness >= 50) lines.push("🟡 Readiness modéré (" + readiness + "/100) : privilégier technique ou intensité réduite.");
  else                     lines.push("🔴 Readiness faible (" + readiness + "/100) : séance légère ou repos recommandé.");

  if (monotony > 2.5) lines.push("⚠️ Monotonie élevée (" + monotony.toFixed(1) + ") : varier les types de séances.");

  if (recovery?.hoursRemaining > 48) {
    lines.push("⏱️ Récupération incomplète : " + recovery.hoursRemaining + "h restantes. Éviter haute intensité.");
  } else if (recovery?.fullyRecovered) {
    lines.push("✅ Récupération complète : athlète physiologiquement disponible.");
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