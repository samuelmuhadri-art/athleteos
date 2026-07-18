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
  // Division par 10 : ramène l'échelle Foster brute (souvent 100-900+ AU)
  // sur une plage comparable à l'ancienne charge manuelle (~150-550),
  // pour rester cohérent avec les seuils déjà définis dans chargeCalculations.js
  return Math.round((durationMinutes * rpe * coef) / 10);
}

/**
 * Calcule la charge hebdomadaire d'un athlète pour une semaine donnée,
 * en sommant la charge de toutes ses séances de cette semaine où un RPE
 * a été renseigné (les séances sans RPE ne comptent pas — pas de valeur
 * inventée).
 *
 * @param {number} athleteId
 * @param {number} week
 * @param {Array} sessions - Séances enrichies avec .validations[] contenant .rpe
 * @returns {{ total: number, sessionCount: number, missingRpeCount: number }}
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
 * semaines présentes dans les séances fournies. Retourne un tableau au
 * même format que l'ancienne table weekly_charge, pour rester compatible
 * avec chargeCalculations.js (getAthleteMetricsForWeek, etc.) sans rien
 * changer dans ce fichier-là.
 *
 * @param {Array} athletes - [{id, ...}]
 * @param {Array} sessions - Séances enrichies (voir computeWeeklyLoadFromSessions)
 * @returns {Array<{athleteId, week, rawLoad}>}
 */
export function computeAllWeeklyLoads(athletes, sessions) {
  const allWeeks = [...new Set(sessions.map((s) => s.week))].sort((a, b) => a - b);
  const result = [];

  athletes.forEach((a) => {
    allWeeks.forEach((week) => {
      const { total, sessionCount } = computeWeeklyLoadFromSessions(a.id, week, sessions);
      // On n'ajoute une entrée que s'il y a au moins une séance avec RPE renseigné,
      // pour ne pas polluer les calculs avec des zéros qui fausseraient les moyennes.
      if (sessionCount > 0) {
        result.push({ athleteId: a.id, week, rawLoad: total });
      }
    });
  });

  return result;
}

/**
 * Ventile la charge du GROUPE par semaine ET par catégorie de séance,
 * à partir des VRAIES séances enregistrées — remplace toute estimation
 * ou pourcentage inventé (ex: "28% force, 24% sprint...").
 *
 * @param {Array} athletes
 * @param {Array} sessions - Séances enrichies (voir computeWeeklyLoadFromSessions)
 * @returns {Array<{week, category, total}>}
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
        if (rpe == null) return; // pas de RPE = pas de charge réelle à compter
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