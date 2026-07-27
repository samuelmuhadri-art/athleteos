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
// neuromusculaire qu'une séance technique à ressenti égal).
//
// ⚠️ SOURCE CANONIQUE (tâche 16) : ces constantes DOIVENT rester identiques
// à la ligne 'v1' de la table Postgres `charge_model_versions`
// (migration 20260727040000_charge_model_versioning.sql) — c'est cette
// table, pas ce fichier, qui fait foi pour le calcul serveur (vue SQL
// weekly_charge) et pour la reproductibilité historique (chaque ligne
// session_athletes garde la version active au moment où son RPE a été
// saisi, jamais recalculée si la version change plus tard). Ce fichier
// reste une copie JS nécessaire au calcul instantané côté client (avant
// même l'enregistrement d'un RPE) — la parité entre les deux est vérifiée
// par test_charge_model_parity.mjs. Changer une valeur ici SANS créer une
// nouvelle version dans charge_model_versions casse cette parité et doit
// être considéré comme un bug, pas une simple config.
// ============================================================

export const CURRENT_MODEL_VERSION = "v1";

/**
 * Coefficients d'ajustement par catégorie de séance.
 * Valeurs par défaut inspirées des pratiques courantes en périodisation
 * (plus élevé = impact structurel/neuromusculaire plus important).
 * Modifiables uniquement en créant une nouvelle version dans
 * charge_model_versions (jamais en éditant ces valeurs in-place — voir
 * l'avertissement "SOURCE CANONIQUE" ci-dessus).
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
// Même remarque "SOURCE CANONIQUE" que LOAD_COEFFICIENTS ci-dessus.
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

// ─── AJOUT v3.0 (tâche 17) : récupération = plage + confiance, pas un point ──
// Hasegawa T, et al. (2024). PeerJ 12:e17443, pour l'ordre de grandeur par
// catégorie. RECOVERY_HOURS_RANGE (ci-dessous) remplace un chiffre unique
// par une fourchette : personne ne récupère en exactement 72h, ni tout le
// monde à la même vitesse. Voir l'avertissement "SOURCE CANONIQUE" plus
// haut dans ce fichier — ces plages sont des paramètres expérimentaux
// AthleteOS (liés à CURRENT_MODEL_VERSION), pas des bornes publiées.
//
// Ancien comportement corrigé : sans séance récente, computeRecoveryStatus
// renvoyait `fullyRecovered: true` — une certitude fabriquée à partir de
// rien. estimateRecovery renvoie maintenant explicitement
// status: "insufficient_data" dans ce cas.
export const RECOVERY_HOURS_RANGE = {
  sprint:       { min: 48, max: 96 },  // centre historique 72h
  haies:        { min: 48, max: 96 },
  force:        { min: 48, max: 96 },
  saut:         { min: 32, max: 64 },  // centre historique 48h
  lancer:       { min: 32, max: 64 },
  endurance:    { min: 24, max: 48 },  // centre historique 36h
  technique:    { min: 16, max: 32 },  // centre historique 24h
  mobilite:     { min: 6,  max: 18 },  // centre historique 12h
  recuperation: { min: 6,  max: 18 },
};

const WELLNESS_FRESH_HOURS = 36; // au-delà, wellness jugé périmé — pas fiable pour "maintenant"
const BAND_WIDTH = 0.4;          // la plage affichée couvre toujours au moins 40% de l'étendue de la catégorie

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

/**
 * Estimation de récupération neuromusculaire/métabolique après la dernière
 * séance validée d'un athlète. Renvoie une PLAGE d'heures restantes (jamais
 * un chiffre unique ni un "totalement récupéré" catégorique), un niveau de
 * confiance qui baisse quand les données manquent ou sont anciennes, et la
 * liste des facteurs qui ont fait varier l'estimation — pour que l'athlète
 * et le coach voient POURQUOI, pas juste un nombre.
 *
 * @param sessions  séances mappées (comme ailleurs dans l'app)
 * @param athleteId number
 * @param wellness  dernier questionnaire wellness connu ({date, sleep,
 *                  energy, soreness, mood, stress}) ou null si aucun
 * @param now       Date — paramétrable pour les tests
 */
export function estimateRecovery(sessions, athleteId, wellness = null, now = new Date()) {
  const doneSessions = (sessions ?? [])
    .map(s => {
      const v = s.validations?.find(x => x.athleteId === athleteId);
      return v?.status === "done" && s.sessionDate ? { ...s, rpe: v.rpe ?? null } : null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate));

  if (!doneSessions.length) {
    return {
      status: "insufficient_data", confidence: "faible", confidenceScore: 0,
      rangeHoursMin: null, rangeHoursMax: null, lastSession: null, factors: [],
    };
  }

  const last  = doneSessions[0];
  const range = RECOVERY_HOURS_RANGE[last.category] ?? RECOVERY_HOURS_RANGE.technique;
  const sessionEnd = new Date(last.sessionDate);
  sessionEnd.setHours(20, 0, 0, 0);
  const hoursElapsed = Math.max(0, (now - sessionEnd) / (1000 * 60 * 60));

  let center = 0.5; // position normalisée dans la plage de la catégorie (0 = borne basse, 1 = borne haute)
  const factors = [];
  let confidenceScore = 30; // séance de référence connue (catégorie + date) — toujours acquis ici

  // ── Charge relative : cette séance vs la moyenne récente de l'athlète ──
  const recentWithLoad = doneSessions
    .slice(0, 8)
    .filter(s => s.rpe != null && s.durationMinutes != null)
    .map(s => ({ ...s, load: s.durationMinutes * s.rpe }));
  if (recentWithLoad.length >= 2) {
    const lastLoad = recentWithLoad[0].load;
    const avgLoad  = recentWithLoad.slice(1).reduce((a, s) => a + s.load, 0) / (recentWithLoad.length - 1);
    if (avgLoad > 0) {
      const relLoad = lastLoad / avgLoad;
      if (relLoad > 1.3)      { center += 0.20; factors.push({ label: "Séance plus dure que d'habitude pour cet athlète", direction: "increase" }); }
      else if (relLoad < 0.7) { center -= 0.15; factors.push({ label: "Séance plus légère que d'habitude", direction: "decrease" }); }
      confidenceScore += 20;
    }
  }

  // ── RPE brut de la séance déclenchante ──
  if (last.rpe != null) {
    if (last.rpe >= 8)      { center += 0.15; factors.push({ label: `RPE élevé (${last.rpe}/10)`, direction: "increase" }); }
    else if (last.rpe <= 3) { center -= 0.10; factors.push({ label: `RPE faible (${last.rpe}/10)`, direction: "decrease" }); }
  }

  // ── Wellness — uniquement si présent ET récent (sinon on ne l'utilise pas
  //    silencieusement comme s'il reflétait l'état actuel) ──
  if (wellness) {
    const ageHours = wellness.date ? (now - new Date(wellness.date)) / (1000 * 60 * 60) : Infinity;
    const fresh = ageHours <= WELLNESS_FRESH_HOURS;
    confidenceScore += fresh ? 25 : 10;
    if (fresh) {
      if (wellness.sleep <= 2)      { center += 0.15; factors.push({ label: "Sommeil rapporté mauvais", direction: "increase" }); }
      else if (wellness.sleep >= 4) { center -= 0.10; factors.push({ label: "Sommeil rapporté bon", direction: "decrease" }); }
      if (wellness.soreness >= 4)   { center += 0.15; factors.push({ label: "Courbatures importantes rapportées", direction: "increase" }); }
      if (wellness.stress >= 4)     { center += 0.10; factors.push({ label: "Stress élevé rapporté", direction: "increase" }); }
    }
  }

  // ── Accumulation récente : séances difficiles sur les 7 derniers jours ──
  const sevenDaysAgo   = new Date(now.getTime() - 7 * 86400000);
  const recentSessions = doneSessions.filter(s => new Date(s.sessionDate) >= sevenDaysAgo);
  if (recentSessions.length >= 2) {
    confidenceScore += 25;
    const hardRecent = recentSessions.filter(s => s.rpe != null && s.rpe >= 7).length;
    if (hardRecent >= 3) { center += 0.15; factors.push({ label: `${hardRecent} séances difficiles cette semaine`, direction: "increase" }); }
  }

  center = clamp01(center);
  const halfBand = BAND_WIDTH / 2;
  const posMin = clamp01(center - halfBand);
  const posMax = clamp01(center + halfBand);
  const estimateMin = range.min + (range.max - range.min) * posMin;
  const estimateMax = range.min + (range.max - range.min) * posMax;

  const rangeHoursMin = Math.max(0, Math.round(estimateMin - hoursElapsed));
  const rangeHoursMax = Math.max(0, Math.round(estimateMax - hoursElapsed));

  let status;
  if (rangeHoursMax === 0)    status = "likely_recovered";
  else if (rangeHoursMin > 0) status = "recovering";
  else                        status = "uncertain";

  confidenceScore = Math.max(0, Math.min(100, confidenceScore));
  const confidence = confidenceScore >= 70 ? "élevée" : confidenceScore >= 40 ? "modérée" : "faible";

  return { status, confidence, confidenceScore, rangeHoursMin, rangeHoursMax, lastSession: last, factors };
}