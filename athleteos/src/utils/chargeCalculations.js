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
// ============================================================

// ─── Coefficients par catégorie (convention coaching, non scientifique) ───────
// Pondération multiplicative sur la charge session-RPE selon le type de séance.
// Logique : certaines catégories génèrent une fatigue neuromusculaire plus élevée
// que ce que le RPE seul capte (ex: force maximale = stress articulaire élevé).
export const LOAD_COEFFICIENTS = {
  sprint:       1.2,  // fatigue neuromusculaire élevée, récup 48-72h [7]
  haies:        1.2,  // similaire sprint avec contrainte technique
  force:        1.3,  // stress articulaire et neuromusculaire maximal [7]
  saut:         1.25, // récup neuromusculaire 48h [7]
  lancer:       1.1,  // charge épaule/dos, moins cardio
  endurance:    1.0,  // charge cardiovasculaire, bien capturée par RPE [1]
  technique:    0.8,  // charge cognitive > physique
  mobilite:     0.6,  // charge minimale
  recuperation: 0.5,  // intentionnellement faible
};

// ─── Temps de récupération par catégorie (heures) ─────────────────────────────
// Basé sur [7] : sprint/force = 48-72h, saut = 48h, technique = 24h
export const RECOVERY_HOURS = {
  sprint:       72,
  haies:        72,
  force:        72,
  saut:         48,
  lancer:       48,
  endurance:    36,
  technique:    24,
  mobilite:     12,
  recuperation: 12,
};

// ─── Constantes EWMA [4] ──────────────────────────────────────────────────────
// λ (lambda) = constante de lissage
// λa = 2/(N+1) avec N=7 jours → 0.25 (charge aiguë, ~1 semaine)
// λc = 2/(N+1) avec N=28 jours → 0.067 (charge chronique, ~4 semaines)
// Choix N=7/28 au lieu de 4/12 semaines pour calcul journalier cohérent
const LAMBDA_ACUTE   = 2 / (7  + 1); // ≈ 0.25
const LAMBDA_CHRONIC = 2 / (28 + 1); // ≈ 0.067

// ─── Calcul EWMA sur une série de charges journalières ────────────────────────
// [4] Williams et al. 2017 : l'EWMA pondère les charges récentes davantage
// que les anciennes, ce qui est plus fidèle à la réalité physiologique.
//
// @param dailyLoads : array [{date: "YYYY-MM-DD", load: number}] trié par date croissante
// @returns { acute, chronic, acwr, ewmaHistory }
export function computeEWMA(dailyLoads) {
  if (!dailyLoads?.length) return { acute: 0, chronic: 0, acwr: 1.0, ewmaHistory: [] };

  let ewmaAcute   = dailyLoads[0].load;
  let ewmaChronic = dailyLoads[0].load;
  const history   = [];

  for (const { date, load } of dailyLoads) {
    ewmaAcute   = load * LAMBDA_ACUTE   + ewmaAcute   * (1 - LAMBDA_ACUTE);
    ewmaChronic = load * LAMBDA_CHRONIC + ewmaChronic * (1 - LAMBDA_CHRONIC);
    history.push({ date, acute: Math.round(ewmaAcute), chronic: Math.round(ewmaChronic) });
  }

  const acwr = ewmaChronic > 0 ? ewmaAcute / ewmaChronic : 1.0;
  return {
    acute:       Math.round(ewmaAcute),
    chronic:     Math.round(ewmaChronic),
    acwr:        Math.round(acwr * 100) / 100,
    ewmaHistory: history,
  };
}

// ─── Monotonie et Contrainte [2] ──────────────────────────────────────────────
// Foster (1998) :
//   Monotonie  = charge_moyenne / écart-type
//   Contrainte = charge_totale × monotonie
// Un entraînement monotone (même charge chaque jour) est plus risqué
// qu'un entraînement varié à charge totale égale.
//
// @param weeklyDailyLoads : array de charges journalières sur une semaine
export function computeMonotonyAndStrain(weeklyDailyLoads) {
  if (!weeklyDailyLoads?.length) return { monotony: 0, strain: 0 };

  const n    = weeklyDailyLoads.length;
  const mean = weeklyDailyLoads.reduce((a, b) => a + b, 0) / n;
  const variance = weeklyDailyLoads.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const sd   = Math.sqrt(variance);

  const monotony = sd > 0 ? Math.round((mean / sd) * 100) / 100 : 0;
  const strain   = Math.round(mean * n * monotony);

  return { monotony, strain };
}

// ─── Score wellness (Hooper Index) [5][6] ─────────────────────────────────────
// Saw et al. (2016) : les mesures subjectives sont plus sensibles et fiables
// que les mesures objectives pour refléter les changements de charge.
// McLean et al. (2010) : Hooper Index = sommeil + énergie + courbatures + stress
//
// @param wellness : { sleep, energy, soreness, mood, stress } — chacun 1 à 5
// @returns score normalisé 0-100 (100 = état optimal)
export function computeWellnessScore(wellness) {
  if (!wellness) return null;
  const { sleep, energy, soreness, mood, stress } = wellness;
  if ([sleep, energy, soreness, mood, stress].some(v => v == null)) return null;

  // soreness et stress sont inversés (5 = mauvais)
  const score = (
    sleep   * 20 +   // 0-100, 5 = excellent
    energy  * 20 +   // 0-100
    (6 - soreness) * 20 + // inversé : 5 courbatures = 0 points
    mood    * 20 +
    (6 - stress)  * 20    // inversé : 5 stress = 0 points
  ) / 5;

  return Math.round(Math.max(0, Math.min(100, score)));
}

// ─── Temps de récupération restant ────────────────────────────────────────────
// Basé sur [7] : calcule pour chaque système physiologique combien d'heures
// de récupération restent selon les séances passées.
//
// @param sessions : array de séances avec { sessionDate, category, validations }
// @param athleteId : number
// @returns { hoursRemaining, fullyRecovered, lastSession }
export function computeRecoveryStatus(sessions, athleteId) {
  const now = new Date();
  let maxHoursRemaining = 0;
  let lastSession = null;

  const doneSessions = sessions.filter(s =>
    s.validations?.some(v => v.athleteId === athleteId && v.status === "done") &&
    s.sessionDate
  );

  for (const s of doneSessions) {
    const sessionEnd  = new Date(s.sessionDate);
    sessionEnd.setHours(20, 0, 0, 0); // on suppose fin de séance à 20h
    const hoursNeeded = RECOVERY_HOURS[s.category] ?? 36;
    const hoursElapsed = (now - sessionEnd) / (1000 * 60 * 60);
    const hoursRemaining = Math.max(0, hoursNeeded - hoursElapsed);

    if (hoursRemaining > maxHoursRemaining) {
      maxHoursRemaining = hoursRemaining;
      lastSession = s;
    }
  }

  return {
    hoursRemaining: Math.round(maxHoursRemaining),
    fullyRecovered: maxHoursRemaining === 0,
    lastSession,
  };
}

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

  // Risque blessure : ACWR élevé + monotonie élevée + récupération insuffisante
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