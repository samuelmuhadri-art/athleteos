// ============================================================
// AthleteOS — src/utils/weeklyReports.js
//
// Logique de calcul des rapports hebdomadaires — utilisée à la fois
// par le module coach (src/modules/Rapports.jsx) et la vue athlète
// (src/athlete/views/MesRapports.jsx), pour ne jamais faire diverger
// les deux. Pas de nouvelle table : tout est recalculé à la volée
// depuis sessions/session_athletes (déjà chargés par les vues
// existantes) + athlete_wellness pour la semaine concernée.
//
// Toutes les charges passent par computeSessionLoad (chargeCalculations.js
// → trainingLoad.js), la même formule que la vue SQL weekly_charge —
// aucun nouveau calcul de charge inventé ici.
// ============================================================

import { computeSessionLoad, computeWellnessScore, getAthleteMetricsForWeek } from "./chargeCalculations";
import { CATEGORIES } from "../athlete/shared";
import { getISOWeekInfo, matchesISOWeek, parseLocalDate } from "./helpers.js";

// ─── Semaines disponibles ─────────────────────────────────────────────────
// Liste triée (desc) des semaines ISO présentes dans les séances,
// avec la plage de dates réelle (basée sur session_date, pas un calcul
// d'arithmétique de calendrier) et le nombre de séances qu'elle contient.
export function getAvailableWeeks(sessions, athleteId = null) {
  const relevant = athleteId
    ? sessions.filter(s => s.athleteIds?.includes(athleteId))
    : sessions;

  const byWeek = new Map();
  relevant.forEach(s => {
    if (!s.sessionDate) return;
    const { week, year } = getISOWeekInfo(parseLocalDate(s.sessionDate));
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    if (!byWeek.has(key)) byWeek.set(key, { week, isoYear: year, sessions: [] });
    byWeek.get(key).sessions.push(s);
  });

  return [...byWeek.entries()]
    .map(([key, { week, isoYear, sessions: weekSessions }]) => {
      const dates = weekSessions.map(s => s.sessionDate).filter(Boolean).sort();
      return {
        key, week, isoYear,
        sessionCount: weekSessions.length,
        dateRange: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null,
      };
    })
    .sort((a, b) => b.key.localeCompare(a.key));
}

export function formatWeekLabel(week, dateRange, isoYear = null) {
  if (!dateRange) return `Semaine ${week}${isoYear ? ` · ${isoYear}` : ""}`;
  const opts = { day: "numeric", month: "short" };
  const start = new Date(dateRange.start + "T00:00:00").toLocaleDateString("fr-BE", opts);
  const end   = new Date(dateRange.end   + "T00:00:00").toLocaleDateString("fr-BE", { ...opts, year: "numeric" });
  return `Semaine ${week} — ${start} au ${end}`;
}

// ─── Résumé texte automatique ─────────────────────────────────────────────
function buildSummaryText({ total, done, partial, none, totalLoad, categoriesWorked, categoriesAbsent, load7, load28, variationPercent }) {
  if (total === 0) return "Aucune séance planifiée cette semaine.";
  const lines = [];

  lines.push(
    `${done}/${total} séance${total > 1 ? "s" : ""} réalisée${done > 1 ? "s" : ""}` +
    (partial ? `, ${partial} partielle${partial > 1 ? "s" : ""}` : "") +
    (none ? `, ${none} manquée${none > 1 ? "s" : ""}` : "") + "."
  );

  lines.push(`Effort cumulé cette semaine : ${totalLoad} points (durée réelle × effort ressenti).`);

  if (categoriesWorked.length) {
    const top = categoriesWorked.slice(0, 2).map(c => CATEGORIES.find(x => x.id === c.id)?.label ?? c.id);
    lines.push(`Catégories les plus travaillées : ${top.join(", ")}.`);
  }
  if (categoriesAbsent.length && categoriesAbsent.length < CATEGORIES.length) {
    const absentLabels = categoriesAbsent.map(id => CATEGORIES.find(c => c.id === id)?.label ?? id);
    lines.push(`Non travaillées : ${absentLabels.join(", ")}.`);
  }

  if (load7 != null && load28 != null) {
    const direction = variationPercent == null
      ? "La comparaison avec l'habitude n'est pas encore disponible."
      : variationPercent >= 10
        ? `La charge est plus élevée que l'habitude (+${variationPercent} %).`
        : variationPercent <= -10
          ? `La charge est plus basse que l'habitude (${variationPercent} %).`
          : `La charge est stable par rapport à l'habitude (${variationPercent >= 0 ? "+" : ""}${variationPercent} %).`;
    lines.push(`${direction} Cette semaine : ${load7} points ; quatre dernières semaines : ${load28} points.`);
  }

  return lines.join(" ");
}

// ─── Rapport hebdomadaire d'un athlète ────────────────────────────────────
// @param athleteId    number
// @param week         number (semaine ISO)
// @param sessions     séances mappées (voir Dashboard.jsx / AthleteApp.jsx)
// @param weeklyCharge [{ athleteId, week, rawLoad }]
// @param wellnessRows [{ athleteId, date, sleep, energy, soreness, mood, stress }] — déjà filtré sur la plage de la semaine par l'appelant
export function buildWeeklyReport({ athleteId, week, isoYear, sessions, weeklyCharge, wellnessRows = [] }) {
  const weekSessions = sessions
    .filter(s => matchesISOWeek(s, week, isoYear) && s.athleteIds?.includes(athleteId))
    .map(s => {
      const v = s.validations?.find(x => x.athleteId === athleteId) ?? {};
      const load = v.rpe != null ? computeSessionLoad(v.actualDurationMinutes, v.rpe, s.category) : null;
      return {
        id: s.id, title: s.title, category: s.category, trainingFocus: s.trainingFocus, day: s.day,
        sessionDate: s.sessionDate, durationMinutes: s.durationMinutes,
        actualDurationMinutes: v.actualDurationMinutes ?? null,
        durationSource: v.durationSource ?? null,
        status: v.status ?? null, rpe: v.rpe ?? null, feeling: v.feeling ?? null,
        comment: v.comment ?? null, load,
      };
    })
    .sort((a, b) => (a.sessionDate || "").localeCompare(b.sessionDate || ""));

  const total   = weekSessions.length;
  const done    = weekSessions.filter(s => s.status === "done").length;
  const partial = weekSessions.filter(s => s.status === "partial").length;
  const none    = weekSessions.filter(s => s.status === "none").length;
  const totalLoad = weekSessions.reduce((sum, s) => sum + (s.load ?? 0), 0);

  const byCategory = {};
  weekSessions.forEach(s => { if (s.load) byCategory[s.category] = (byCategory[s.category] ?? 0) + s.load; });
  const categoriesWorked = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([id, load]) => ({ id, load, label: CATEGORIES.find(c => c.id === id)?.label ?? id }));
  const workedIds = new Set(categoriesWorked.map(c => c.id));
  const categoriesAbsent = CATEGORIES.filter(c => !workedIds.has(c.id)).map(c => c.id);

  const wellnessForAthlete = wellnessRows.filter(w => (
    w.athleteId === athleteId && w.date && matchesISOWeek(w, week, isoYear)
  ));
  const wellnessScores = wellnessForAthlete.map(w => computeWellnessScore(w)).filter(v => v != null);
  const wellnessAvg = wellnessScores.length
    ? Math.round(wellnessScores.reduce((a, b) => a + b, 0) / wellnessScores.length)
    : null;

  const dates = weekSessions.map(s => s.sessionDate).filter(Boolean).sort();
  const dateRange = dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null;
  const cutoffDate = dates.length ? getISOWeekInfo(parseLocalDate(dates[0])).endDate : null;
  const athleteSessions = sessions.filter(s => (
    s.athleteIds?.includes(athleteId) && (!cutoffDate || !s.sessionDate || s.sessionDate <= cutoffDate)
  ));
  const chargeThroughWeek = weeklyCharge.filter(row => {
    if (row.athleteId !== athleteId) return false;
    if (row.isoYear == null) return row.week <= week;
    return row.isoYear < isoYear || (row.isoYear === isoYear && row.week <= week);
  });
  const metrics = getAthleteMetricsForWeek(
    athleteId, chargeThroughWeek, week, wellnessForAthlete, athleteSessions, cutoffDate,
  );

  const summary = buildSummaryText({
    total, done, partial, none, totalLoad, categoriesWorked, categoriesAbsent,
    load7: metrics.load7, load28: metrics.load28, variationPercent: metrics.variationPercent,
  });

  return {
    week, isoYear, dateRange, sessions: weekSessions,
    stats: { total, done, partial, none, totalLoad },
    categoriesWorked, categoriesAbsent, wellnessAvg, metrics, summary,
  };
}

// ─── Agrégat "Vue Mois" — 4 dernières semaines, par athlète ───────────────
export function buildMonthlyAggregate({ athleteId, weeks, sessions, weeklyCharge, wellnessRows = [] }) {
  const sorted = [...weeks].sort((a, b) => a.key.localeCompare(b.key)); // ascendant : plus ancienne → plus récente
  const weeklyReports = sorted.map(({ week, isoYear }) => (
    buildWeeklyReport({ athleteId, week, isoYear, sessions, weeklyCharge, wellnessRows })
  ));

  const totalLoad     = weeklyReports.reduce((s, r) => s + r.stats.totalLoad, 0);
  const sessionsTotal = weeklyReports.reduce((s, r) => s + r.stats.total, 0);
  const doneTotal     = weeklyReports.reduce((s, r) => s + r.stats.done, 0);

  const byCategory = {};
  weeklyReports.forEach(r => r.categoriesWorked.forEach(c => {
    byCategory[c.id] = (byCategory[c.id] ?? 0) + c.load;
  }));
  const categoriesWorked = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([id, load]) => ({ id, load, label: CATEGORIES.find(c => c.id === id)?.label ?? id }));

  const mid = Math.ceil(weeklyReports.length / 2);
  const firstHalf  = weeklyReports.slice(0, mid).reduce((s, r) => s + r.stats.totalLoad, 0);
  const secondHalf = weeklyReports.slice(mid).reduce((s, r) => s + r.stats.totalLoad, 0);
  const trend = weeklyReports.length < 2
    ? "flat"
    : firstHalf === 0
    ? (secondHalf > 0 ? "up" : "flat")
    : (secondHalf > firstHalf * 1.1 ? "up" : secondHalf < firstHalf * 0.9 ? "down" : "flat");

  return { weeks: weeklyReports, totalLoad, sessionsTotal, doneTotal, categoriesWorked, trend };
}
