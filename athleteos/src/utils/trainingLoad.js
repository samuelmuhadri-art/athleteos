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
//   → Mesures aiguës après sprint ; ne valide pas des délais fixes de récupération.
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
// La charge globale n'applique aucun coefficient de catégorie. Les
// contraintes spécifiques sont des dimensions descriptives séparées.
//
// ⚠️ SOURCE CANONIQUE : ces constantes DOIVENT rester identiques
// à la version active de la table Postgres `charge_model_versions`
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

export const CURRENT_MODEL_VERSION = "v2-session-rpe-standard";

/**
 * Compatibilité avec les formulaires historiques qui enregistrent encore
 * `load_weight`. La charge session-RPE globale n'utilise plus ces valeurs :
 * les contraintes spécifiques sont exposées séparément dans loadAxes.js.
 */
export const LOAD_COEFFICIENTS = {
  force: 1, sprint: 1, haies: 1, lancer: 1, saut: 1,
  endurance: 1, technique: 1, mobilite: 1, recuperation: 1,
};

// ─── AJOUT v2.0 : Temps de récupération par catégorie (heures) ───────────────
// Valeurs historiques conservées comme règles d'espacement de programmation.
// Elles sont configurables et ne constituent pas des temps physiologiques.
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
 * @returns {number|null} Charge arrondie, ou null si données manquantes
 */
export function computeSessionLoad(durationMinutes, rpe) {
  if (durationMinutes == null || rpe == null) return null;
  const duration = Number(durationMinutes);
  const perceivedExertion = Number(rpe);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  if (!Number.isFinite(perceivedExertion) || perceivedExertion < 0 || perceivedExertion > 10) return null;
  return Math.round(duration * perceivedExertion);
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
    const duration = validation?.actualDurationMinutes;
    const load = computeSessionLoad(duration, rpe);
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
        const duration = validation?.actualDurationMinutes;
        const load = computeSessionLoad(duration, rpe);
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
// λ courte = 2/(7+1) ; λ longue = 2/(28+1). Ces paramètres supposent
// strictement un point par JOUR, jamais un total hebdomadaire déguisé.
const LAMBDA_ACUTE   = 2 / (7  + 1);
const LAMBDA_CHRONIC = 2 / (28 + 1);

export function computeEWMA(dailyLoads) {
  const ordered = (dailyLoads ?? [])
    .filter((point) => point?.date)
    .map((point) => ({ ...point, load: point.load == null ? null : Number(point.load) }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!ordered.length) {
    return { acute: null, chronic: null, acwr: null, ewmaHistory: [], observedDays: 0, status: "insufficient_data" };
  }

  // Une valeur inconnue casse la continuité : l'algorithme reprend au
  // prochain point connu, mais aucun ratio n'est publié avant 28 nouveaux
  // jours consécutifs. On ne transforme jamais silencieusement null en 0.
  let ewmaAcute = null;
  let ewmaChronic = null;
  let observedDays = 0;
  const history   = [];

  for (const { date, load } of ordered) {
    if (!Number.isFinite(load) || load < 0) {
      ewmaAcute = null;
      ewmaChronic = null;
      observedDays = 0;
      history.push({ date, load: null, acute: null, chronic: null });
      continue;
    }
    if (ewmaAcute == null || ewmaChronic == null) {
      ewmaAcute = load;
      ewmaChronic = load;
    } else {
      ewmaAcute   = load * LAMBDA_ACUTE   + ewmaAcute   * (1 - LAMBDA_ACUTE);
      ewmaChronic = load * LAMBDA_CHRONIC + ewmaChronic * (1 - LAMBDA_CHRONIC);
    }
    observedDays += 1;
    history.push({ date, load, acute: Math.round(ewmaAcute), chronic: Math.round(ewmaChronic) });
  }

  const enoughForExperimentalRatio = observedDays >= 28 && ewmaChronic > 0;
  const acwr = enoughForExperimentalRatio ? ewmaAcute / ewmaChronic : null;
  return {
    acute:       ewmaAcute == null ? null : Math.round(ewmaAcute),
    chronic:     ewmaChronic == null ? null : Math.round(ewmaChronic),
    acwr:        acwr == null ? null : Math.round(acwr * 100) / 100,
    ewmaHistory: history,
    observedDays,
    status: enoughForExperimentalRatio ? "experimental" : "insufficient_data",
  };
}

function toDateKey(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/u);
  return match?.[1] ?? null;
}

function addUtcDays(dateKey, amount) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function isoWeekFromDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function endOfIsoWeek(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return addUtcDays(dateKey, 7 - (date.getUTCDay() || 7));
}

function localTodayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

/** Construit une série civile continue. Les dates absentes restent `null`. */
export function buildContinuousDailyLoadSeries(points, startDate, endDate) {
  const normalized = new Map();
  (points ?? []).forEach((point) => {
    const date = toDateKey(point?.date);
    if (!date) return;
    const load = point.load == null || point.estimated ? null : Number(point.load);
    normalized.set(date, Number.isFinite(load) && load >= 0 ? load : null);
  });
  const keys = [...normalized.keys()].sort();
  const start = toDateKey(startDate) ?? keys[0] ?? null;
  const end = toDateKey(endDate) ?? keys.at(-1) ?? null;
  if (!start || !end || start > end) return [];

  const series = [];
  for (let date = start; date <= end; date = addUtcDays(date, 1)) {
    series.push({ date, load: normalized.has(date) ? normalized.get(date) : null });
  }
  return series;
}

/** Extrait les jours détaillés fournis par la vue SQL weekly_charge v2. */
export function extractDailyLoads(athleteId, weeklyCharge, currentWeek, cutoffDate = null) {
  const rows = (weeklyCharge ?? [])
    .filter((row) => row.athleteId === athleteId);
  const points = rows.flatMap((row) => row.dailyLoads ?? []);
  if (!points.length) return [];

  const today = localTodayKey();
  let end = toDateKey(cutoffDate);
  if (!end && currentWeek != null) {
    const matchingDates = points
      .map((point) => toDateKey(point.date))
      .filter((date) => date && date <= today && isoWeekFromDateKey(date) === currentWeek)
      .sort();
    if (matchingDates.length) end = endOfIsoWeek(matchingDates.at(-1));
  }
  if (!end) end = today;
  if (end > today && !cutoffDate) end = today;

  const start = addUtcDays(end, -55);
  return buildContinuousDailyLoadSeries(points, start, end);
}

export function computeLoadWindows(dailyLoads) {
  const last = (dailyLoads ?? []).slice(-28);
  const last7 = last.slice(-7);
  const known7 = last7.length === 7 && last7.every((point) => Number.isFinite(point.load));
  const known28 = last.length === 28 && last.every((point) => Number.isFinite(point.load));
  const load7 = known7 ? last7.reduce((sum, point) => sum + point.load, 0) : null;
  const load28 = known28 ? last.reduce((sum, point) => sum + point.load, 0) : null;
  const previous21 = known28 ? last.slice(0, 21) : [];
  const recentDailyAverage = load7 == null ? null : load7 / 7;
  const habitualDailyAverage = known28
    ? previous21.reduce((sum, point) => sum + point.load, 0) / 21
    : null;
  const variationPercent = habitualDailyAverage > 0
    ? Math.round(((recentDailyAverage - habitualDailyAverage) / habitualDailyAverage) * 100)
    : null;
  return { load7, load28, recentDailyAverage, habitualDailyAverage, variationPercent, known7, known28 };
}

// ─── AJOUT v2.0 : Monotonie et Contrainte ────────────────────────────────────
// Foster C. (1998). Medicine & Science in Sports & Exercise, 30(7), 1164-1168.
// Monotonie  = charge_moyenne / écart-type
// Contrainte = charge_totale × monotonie
export function computeMonotonyAndStrain(dailyLoads) {
  if (!Array.isArray(dailyLoads) || dailyLoads.length !== 7 || dailyLoads.some((value) => !Number.isFinite(value) || value < 0)) {
    return { monotony: null, strain: null, status: "insufficient_data" };
  }
  const mean = dailyLoads.reduce((a, b) => a + b, 0) / 7;
  const sd = Math.sqrt(dailyLoads.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / 7);
  if (sd === 0) return { monotony: null, strain: null, status: "undefined_zero_variance" };
  const monotony = Math.round((mean / sd) * 100) / 100;
  return { monotony, strain: Math.round(dailyLoads.reduce((a, b) => a + b, 0) * monotony), status: "available" };
}

// AthleteOS Wellness Questionnaire v1 — instrument interne non validé.
// Il ne doit pas être présenté comme le Hooper Index, qui utilise quatre
// dimensions différentes. Les cinq réponses 1..5 sont normalisées sur 0..100.
export function computeWellnessScore(wellness) {
  if (!wellness) return null;
  const { sleep, energy, soreness, mood, stress } = wellness;
  if ([sleep, energy, soreness, mood, stress].some(v => v == null)) return null;
  const normalizedMean = (sleep + energy + (6 - soreness) + mood + (6 - stress)) / 5;
  const score = ((normalizedMean - 1) / 4) * 100;
  return Math.round(Math.max(0, Math.min(100, score)));
}

// Règles de programmation configurables — pas des temps physiologiques.
// Elles servent uniquement à espacer deux séances ciblant une même
// contrainte. Le nom historique est conservé pour compatibilité d'import.
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

function sessionEndDate(session, actualDurationMinutes) {
  if (!session?.sessionDate || !session?.time) return null;
  const time = String(session.time).match(/^(\d{1,2}):(\d{2})/u);
  if (!time) return null;
  const end = new Date(`${String(session.sessionDate).slice(0, 10)}T00:00:00`);
  end.setHours(Number(time[1]), Number(time[2]), 0, 0);
  const duration = Number(actualDurationMinutes);
  if (Number.isFinite(duration) && duration > 0) end.setMinutes(end.getMinutes() + duration);
  return Number.isNaN(end.getTime()) ? null : end;
}

/**
 * Fenêtre de programmation après la dernière séance. Le paramètre `wellness`
 * reste accepté pour ne casser aucun appel, mais n'allonge ni ne raccourcit
 * la règle : AthleteOS ne prétend plus estimer une récupération biologique.
 */
export function estimateRecovery(sessions, athleteId, _wellness = null, now = new Date(), rules = RECOVERY_HOURS_RANGE) {
  const doneSessions = (sessions ?? [])
    .map(s => {
      const v = s.validations?.find(x => x.athleteId === athleteId);
      const endAt = v?.status === "done" || v?.status === "partial"
        ? sessionEndDate(s, v.actualDurationMinutes)
        : null;
      return endAt ? { ...s, validation: v, endAt } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.endAt - a.endAt);

  if (!doneSessions.length) {
    return {
      status: "insufficient_data", kind: "programming_rule", confidence: null, confidenceScore: null,
      rangeHoursMin: null, rangeHoursMax: null, lastSession: null, factors: [], ruleSource: "club_default",
    };
  }

  const last = doneSessions[0];
  const range = rules[last.category] ?? rules.technique ?? { min: 24, max: 48 };
  const hoursElapsed = Math.max(0, (now - last.endAt) / 3_600_000);
  const rangeHoursMin = Math.max(0, Math.round(range.min - hoursElapsed));
  const rangeHoursMax = Math.max(0, Math.round(range.max - hoursElapsed));
  const status = rangeHoursMax === 0 ? "window_elapsed" : rangeHoursMin > 0 ? "spacing_active" : "spacing_transition";
  return {
    status,
    kind: "programming_rule",
    confidence: null,
    confidenceScore: null,
    rangeHoursMin,
    rangeHoursMax,
    lastSession: last,
    factors: [{ label: `Règle ${last.category || "générale"} configurée : ${range.min}–${range.max} h`, direction: "neutral" }],
    ruleSource: "club_default",
  };
}
