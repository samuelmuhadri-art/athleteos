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

// ─── Semaines disponibles ─────────────────────────────────────────────────
// Liste triée (desc) des numéros de semaine ISO présents dans les séances,
// avec la plage de dates réelle (basée sur session_date, pas un calcul
// d'arithmétique de calendrier) et le nombre de séances qu'elle contient.
export function getAvailableWeeks(sessions, athleteId = null) {
  const relevant = athleteId
    ? sessions.filter(s => s.athleteIds?.includes(athleteId))
    : sessions;

  const byWeek = new Map();
  relevant.forEach(s => {
    if (s.week == null) return;
    if (!byWeek.has(s.week)) byWeek.set(s.week, []);
    byWeek.get(s.week).push(s);
  });

  return [...byWeek.entries()]
    .map(([week, weekSessions]) => {
      const dates = weekSessions.map(s => s.sessionDate).filter(Boolean).sort();
      return {
        week,
        sessionCount: weekSessions.length,
        dateRange: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null,
      };
    })
    .sort((a, b) => b.week - a.week);
}

export function formatWeekLabel(week, dateRange) {
  if (!dateRange) return `Semaine ${week}`;
  const opts = { day: "numeric", month: "short" };
  const start = new Date(dateRange.start + "T00:00:00").toLocaleDateString("fr-BE", opts);
  const end   = new Date(dateRange.end   + "T00:00:00").toLocaleDateString("fr-BE", { ...opts, year: "numeric" });
  return `Semaine ${week} — ${start} au ${end}`;
}

// ─── Résumé texte automatique ─────────────────────────────────────────────
function buildSummaryText({ total, done, partial, none, totalLoad, categoriesWorked, categoriesAbsent, acwr }) {
  if (total === 0) return "Aucune séance planifiée cette semaine.";
  const lines = [];

  lines.push(
    `${done}/${total} séance${total > 1 ? "s" : ""} réalisée${done > 1 ? "s" : ""}` +
    (partial ? `, ${partial} partielle${partial > 1 ? "s" : ""}` : "") +
    (none ? `, ${none} manquée${none > 1 ? "s" : ""}` : "") + "."
  );

  lines.push(`Charge totale de la semaine : ${totalLoad} u.a.`);

  if (categoriesWorked.length) {
    const top = categoriesWorked.slice(0, 2).map(c => CATEGORIES.find(x => x.id === c.id)?.label ?? c.id);
    lines.push(`Catégories les plus travaillées : ${top.join(", ")}.`);
  }
  if (categoriesAbsent.length && categoriesAbsent.length < CATEGORIES.length) {
    const absentLabels = categoriesAbsent.map(id => CATEGORIES.find(c => c.id === id)?.label ?? id);
    lines.push(`Non travaillées : ${absentLabels.join(", ")}.`);
  }

  if (acwr != null) {
    if (acwr > 1.3)      lines.push(`⚠️ ACWR de ${acwr.toFixed(2)} — zone de surcharge, à surveiller.`);
    else if (acwr < 0.8) lines.push(`🔵 ACWR de ${acwr.toFixed(2)} — sous-charge relative.`);
    else                 lines.push(`🟢 ACWR de ${acwr.toFixed(2)} — dans la zone optimale (0.8–1.3).`);
  }

  return lines.join(" ");
}

// ─── Rapport hebdomadaire d'un athlète ────────────────────────────────────
// @param athleteId    number
// @param week         number (semaine ISO)
// @param sessions     séances mappées (voir Dashboard.jsx / AthleteApp.jsx)
// @param weeklyCharge [{ athleteId, week, rawLoad }]
// @param wellnessRows [{ athleteId, date, sleep, energy, soreness, mood, stress }] — déjà filtré sur la plage de la semaine par l'appelant
export function buildWeeklyReport({ athleteId, week, sessions, weeklyCharge, wellnessRows = [] }) {
  const weekSessions = sessions
    .filter(s => s.week === week && s.athleteIds?.includes(athleteId))
    .map(s => {
      const v = s.validations?.find(x => x.athleteId === athleteId) ?? {};
      const load = v.rpe != null ? computeSessionLoad(s.durationMinutes, v.rpe, s.category) : null;
      return {
        id: s.id, title: s.title, category: s.category, day: s.day,
        sessionDate: s.sessionDate, durationMinutes: s.durationMinutes,
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

  const wellnessForAthlete = wellnessRows.filter(w => w.athleteId === athleteId);
  const wellnessScores = wellnessForAthlete.map(w => computeWellnessScore(w)).filter(v => v != null);
  const wellnessAvg = wellnessScores.length
    ? Math.round(wellnessScores.reduce((a, b) => a + b, 0) / wellnessScores.length)
    : null;

  const athleteSessions = sessions.filter(s => s.athleteIds?.includes(athleteId));
  const metrics = getAthleteMetricsForWeek(athleteId, weeklyCharge, week, wellnessForAthlete, athleteSessions);

  const dates = weekSessions.map(s => s.sessionDate).filter(Boolean).sort();
  const dateRange = dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null;

  const summary = buildSummaryText({
    total, done, partial, none, totalLoad, categoriesWorked, categoriesAbsent,
    acwr: total > 0 ? metrics.acwr : null,
  });

  return {
    week, dateRange, sessions: weekSessions,
    stats: { total, done, partial, none, totalLoad },
    categoriesWorked, categoriesAbsent, wellnessAvg, metrics, summary,
  };
}

// ─── Agrégat "Vue Mois" — 4 dernières semaines, par athlète ───────────────
export function buildMonthlyAggregate({ athleteId, weeks, sessions, weeklyCharge, wellnessRows = [] }) {
  const sorted = [...weeks].sort((a, b) => a - b); // ascendant : plus ancienne → plus récente
  const weeklyReports = sorted.map(week => buildWeeklyReport({ athleteId, week, sessions, weeklyCharge, wellnessRows }));

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
  const trend = firstHalf === 0
    ? (secondHalf > 0 ? "up" : "flat")
    : (secondHalf > firstHalf * 1.1 ? "up" : secondHalf < firstHalf * 0.9 ? "down" : "flat");

  return { weeks: weeklyReports, totalLoad, sessionsTotal, doneTotal, categoriesWorked, trend };
}
