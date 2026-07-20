// ============================================================
// AthleteOS — trainingLoad.js
// Calcul de la charge d'entraînement selon la méthode session-RPE
// ============================================================
//
// 📚 RÉFÉRENCES SCIENTIFIQUES (méthode centrale) :
// - Foster C, Florhaug JA, Franklin J, et al. (2001). "A New Approach
//   to Monitoring Exercise Training." Journal of Strength and
//   Conditioning Research, 15(1), 109-115.
// - Foster C. (1998). "Monitoring training in athletes with reference
//   to overtraining syndrome." Medicine & Science in Sports & Exercise,
//   30(7), 1164-1168.
// - Borg G. (1998). Borg's Perceived Exertion and Pain Scales.
//   Human Kinetics. (Origine de l'échelle RPE 0-10 / CR10)
//
// AJOUTS v2.0 :
// - Williams S, Booton T, Watson M, et al. (2017).
//   → EWMA supérieur à la moyenne mobile simple
// - Hasegawa T, et al. (2024). PeerJ 12:e17443.
//   → Temps de récupération neuromusculaire par type de séance
// - Saw AE, Main LC, Gastin PB. (2016). BJSM 50(5), 281-291.
//   → Wellness questionnaire = mesure la plus sensible et fiable
//
// FORMULE CENTRALE (directement issue de Foster et al., validée par
// de nombreuses études en sciences du sport) :
//
//     Charge de séance = Durée (minutes) × RPE (0-10)
//
// Où RPE = Rate of Perceived Exertion, noté par l'athlète lui-même
// sur une échelle de 0 (repos total) à 10 (effort maximal), quelques
// minutes après la fin de la séance.
//
// ⚠️ TRANSPARENCE IMPORTANTE :
// Le COEFFICIENT PAR CATÉGORIE ci-dessous (sprint, force, technique...)
// n'est PAS une valeur tirée directement d'une publication scientifique
// spécifique à l'athlétisme — une table universelle de ce type n'existe
// pas dans la littérature. C'est un paramètre d'AJUSTEMENT PRATIQUE,
// couramment utilisé en planification sportive (périodisation) pour
// refléter que deux séances au même RPE n'ont pas le même impact
// structurel (ex: une séance de force sollicite davantage le système
// neuromusculaire qu'une séance technique à ressenti égal). Ces
// coefficients sont calibrables par le coach selon son groupe.
// ============================================================

/**
 * Coefficients d'ajustement par catégorie de séance.
 * Valeurs par défaut inspirées des pratiques courantes en périodisation
 * (plus élevé = impact structurel/neuromusculaire plus important).
 * Le coach peut les ajuster s'il juge que son groupe répond différemment.
 */
export const LOAD_COEFFICIENTS = {
  force:        1.3,  // Musculation — forte sollicitation neuromusculaire
  sprint:       1.1,  // Sprint — haute intensité nerveuse
  haies:        1.1,  // Haies — proche du sprint techniquement exigeant
  lancer:       1.0,  // Lancers — explosif, charge articulaire
  saut:         1.0,  // Sauts — explosif, charge articulaire
  endurance:    0.9,  // Endurance — métabolique, moins neuromusculaire
  technique:    0.7,  // Technique — intensité généralement plus faible
  mobilite:     0.4,  // Mobilité — très faible impact structurel
  recuperation: 0.3,  // Récupération active — impact minimal
};

// ─── AJOUT v2.0 : Temps de récupération par catégorie (heures) ───────────────
// Basé sur Hasegawa et al. (2024) [7] :
// Sprint/force = récupération neuromusculaire 48-72h
// Saut = 48h, technique = 24h
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

/**
 * Calcule la charge d'UNE séance pour UN athlète.
 * @param {number} durationMinutes - Durée de la séance en minutes
 * @param {number} rpe - Ressenti de l'athlète, 0 à 10 (échelle de Borg CR10)
 * @param {string} category - Catégorie de la séance (clé de LOAD_COEFFICIENTS)
 * @returns {number|null} Charge arrondie, ou null si données manquantes
 */
export function computeSessionLoad(durationMinutes, rpe, category) {
  if (durationMinutes == null || rpe == null) return null;
  const coef = LOAD_COEFFICIENTS[category] ?? 1.0;
  return Math.round((durationMinutes * rpe * coef) / 10);
}

/**
 * Calcule la charge hebdomadaire d'un athlète pour une semaine donnée,
 * en sommant la charge de toutes ses séances de cette semaine où un RPE
 * a été renseigné (les séances sans RPE ne comptent pas — pas de valeur
 * inventée).
 */
export function computeWeeklyLoadFromSessions(athleteId, week, sessions) {
  const weekSessions = sessions.filter((s) => s.week === week && s.athleteIds.includes(athleteId));

  let total = 0;
  let sessionCount = 0;
  let missingRpeCount = 0;

  weekSessions.forEach((s) => {
    const validation = s.validations?.find((v) => v.athleteId === athleteId);
    const rpe = validation?.rpe;
    if (rpe == null) {
      missingRpeCount += 1;
      return;
    }
    const load = computeSessionLoad(s.durationMinutes, rpe, s.category);
    if (load !== null) {
      total += load;
      sessionCount += 1;
    }
  });

  return { total, sessionCount, missingRpeCount };
}

/**
 * Calcule la charge hebdomadaire de TOUS les athlètes, pour TOUTES les
 * semaines présentes dans les séances fournies.
 */
export function computeAllWeeklyLoads(athletes, sessions) {
  const allWeeks = [...new Set(sessions.map((s) => s.week))].sort((a, b) => a - b);
  const result = [];

  athletes.forEach((a) => {
    allWeeks.forEach((week) => {
      const { total, sessionCount } = computeWeeklyLoadFromSessions(a.id, week, sessions);
      if (sessionCount > 0) {
        result.push({ athleteId: a.id, week, rawLoad: total });
      }
    });
  });

  return result;
}

/**
 * Ventile la charge du GROUPE par semaine ET par catégorie de séance.
 */
export function computeWeeklyLoadByCategory(athletes, sessions) {
  const allWeeks = [...new Set(sessions.map((s) => s.week))].sort((a, b) => a - b);
  const result = [];

  allWeeks.forEach((week) => {
    const weekSessions = sessions.filter((s) => s.week === week);
    const byCategory = {};

    weekSessions.forEach((s) => {
      s.athleteIds.forEach((athleteId) => {
        const validation = s.validations?.find((v) => v.athleteId === athleteId);
        const rpe = validation?.rpe;
        if (rpe == null) return;
        const load = computeSessionLoad(s.durationMinutes, rpe, s.category);
        if (load === null) return;
        byCategory[s.category] = (byCategory[s.category] ?? 0) + load;
      });
    });

    Object.entries(byCategory).forEach(([category, total]) => {
      result.push({ week, category, total });
    });
  });

  return result;
}

// ─── AJOUT v2.0 : Interprétation du RPE (Borg CR10) ──────────────────────────
// Borg G. (1998). Borg's Perceived Exertion and Pain Scales. Human Kinetics.
export function getRPELabel(rpe) {
  if (rpe == null) return { label: "Non renseigné", color: "#94a3b8" };
  if (rpe === 0)   return { label: "Repos",          color: "#94a3b8" };
  if (rpe <= 2)    return { label: "Très facile",    color: "#1D9E75" };
  if (rpe <= 4)    return { label: "Facile",         color: "#1D9E75" };
  if (rpe <= 6)    return { label: "Modéré",         color: "#EF9F27" };
  if (rpe <= 8)    return { label: "Difficile",      color: "#EF9F27" };
  if (rpe <= 9)    return { label: "Très difficile", color: "#E24B4A" };
  return                  { label: "Maximum",        color: "#E24B4A" };
}

// ─── AJOUT v2.0 : EWMA (Exponentially Weighted Moving Average) ───────────────
// Williams S, et al. (2017). International Journal of Sports Physiology
// and Performance.
// λa = 2/(7+1) = 0.25 (charge aiguë ~1 semaine)
// λc = 2/(28+1) ≈ 0.067 (charge chronique ~4 semaines)
const LAMBDA_ACUTE   = 2 / (7  + 1);
const LAMBDA_CHRONIC = 2 / (28 + 1);

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

// ─── AJOUT v2.0 : Monotonie et Contrainte ────────────────────────────────────
// Foster C. (1998). Medicine & Science in Sports & Exercise, 30(7), 1164-1168.
// Monotonie  = charge_moyenne / écart-type
// Contrainte = charge_totale × monotonie
export function computeMonotonyAndStrain(weeklyLoads) {
  if (!weeklyLoads?.length) return { monotony: 0, strain: 0 };
  const n    = weeklyLoads.length;
  const mean = weeklyLoads.reduce((a, b) => a + b, 0) / n;
  const sd   = Math.sqrt(weeklyLoads.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n);
  const monotony = sd > 0 ? Math.round((mean / sd) * 100) / 100 : 0;
  const strain   = Math.round(mean * n * monotony);
  return { monotony, strain };
}

// ─── AJOUT v2.0 : Score Wellness (Hooper Index) ──────────────────────────────
// Saw AE, Main LC, Gastin PB. (2016). BJSM 50(5), 281-291.
// McLean BD, et al. (2010). Int J Sports Physiol Perform.
// 5 questions, chacune 1-5 : sommeil, énergie, courbatures, humeur, stress
// soreness et stress sont INVERSÉS (5 = mauvais)
export function computeWellnessScore(wellness) {
  if (!wellness) return null;
  const { sleep, energy, soreness, mood, stress } = wellness;
  if ([sleep, energy, soreness, mood, stress].some(v => v == null)) return null;
  const score = (
    sleep            * 20 +
    energy           * 20 +
    (6 - soreness)   * 20 +
    mood             * 20 +
    (6 - stress)     * 20
  ) / 5;
  return Math.round(Math.max(0, Math.min(100, score)));
}

// ─── AJOUT v2.0 : Récupération neuromusculaire restante ──────────────────────
// Hasegawa T, et al. (2024). PeerJ 12:e17443.
export function computeRecoveryStatus(sessions, athleteId) {
  const now = new Date();
  let maxHoursRemaining = 0;
  let lastSession = null;

  const doneSessions = (sessions ?? []).filter(s =>
    s.validations?.some(v => v.athleteId === athleteId && v.status === "done") &&
    s.sessionDate
  );

  for (const s of doneSessions) {
    const sessionEnd = new Date(s.sessionDate);
    sessionEnd.setHours(20, 0, 0, 0);
    const hoursNeeded   = RECOVERY_HOURS[s.category] ?? 36;
    const hoursElapsed  = (now - sessionEnd) / (1000 * 60 * 60);
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