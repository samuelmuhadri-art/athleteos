// ============================================================
// AthleteOS — src/modules/competitionsShared.js
// Constantes et helpers partagés entre Competitions.jsx, CompCard.jsx,
// CompModal.jsx, CreateCompModal.jsx et AddResultInline.jsx.
// ============================================================

import { getAthleteMetricsForWeek } from "../utils/chargeCalculations.js";
import { getISOWeek, parseLocalDate } from "../utils/helpers.js";

// ─── Config types de compétition (UI statique) ────────────────────────────────

export const TYPE_CONFIG = {
  "préparation": {
    label: "Préparation", bg: "rgba(255,255,255,0.07)", border: "#94A3B8",
    text: "#B6C2CE", dot: "#94A3B8", badge: "bg-slate-100 text-slate-500",
  },
  "régional": {
    label: "Régional", bg: "rgba(91,141,239,0.15)", border: "#378ADD",
    text: "#5B8DEF", dot: "#378ADD", badge: "bg-blue-50 text-blue-700",
  },
  "objectif": {
    label: "Objectif", bg: "rgba(29,158,117,0.15)", border: "#1D9E75",
    text: "#4DC9A0", dot: "#1D9E75", badge: "bg-emerald-50 text-emerald-700",
  },
  "objectif A": {
    label: "Objectif A", bg: "rgba(224,82,82,0.15)", border: "#E24B4A",
    text: "#E05252", dot: "#E24B4A", badge: "bg-red-50 text-red-700",
  },
};

export const ATHLETE_COLORS = [
  "#1D9E75", "#378ADD", "#A855F7", "#EF9F27",
  "#E24B4A", "#14B8A6", "#F97316", "#EC4899",
  "#0EA5E9", "#84CC16",
];

export function getTypeConfig(type) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG["préparation"];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDate(dateStr, opts = {}) {
  return parseLocalDate(dateStr).toLocaleDateString("fr-BE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    ...opts,
  });
}

export function formatDateShort(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString("fr-BE", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function daysUntil(dateStr, referenceDate = new Date()) {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const diff = parseLocalDate(dateStr) - today;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function dateToWeek(dateStr) {
  return getISOWeek(parseLocalDate(dateStr));
}

export function generateResultAnalysis(result, competition, athlete, weeklyCharge) {
  const week    = dateToWeek(competition.date);
  const metrics = getAthleteMetricsForWeek(athlete.id, weeklyCharge, week);
  const { acwr, fatigue, readiness } = metrics;
  const lines = [];

  if (acwr > 1.3) {
    lines.push(
      `⚠️ ACWR de ${acwr.toFixed(2)} à la date de cette compétition (semaine ~${week}). ` +
      `L'athlète était en phase de charge élevée — une performance en deçà du PR est normale et attendue dans ce contexte.`
    );
  } else if (acwr >= 0.8 && acwr <= 1.3) {
    lines.push(
      `✅ ACWR optimal à ${acwr.toFixed(2)} à la date de cette compétition. ` +
      `L'athlète était dans une fenêtre de performance favorable.`
    );
  } else {
    lines.push(
      `📉 ACWR bas (${acwr.toFixed(2)}) à la date de cette compétition. ` +
      `L'athlète était en sous-charge — possibilité de déconditionnement léger.`
    );
  }

  if (fatigue > 65) {
    lines.push(
      `Fatigue estimée à ${fatigue}/100 — niveau élevé. Le résultat doit être interprété avec prudence : ` +
      `la fatigue accumulée peut masquer le vrai niveau de l'athlète.`
    );
  } else if (fatigue < 35) {
    lines.push(
      `Fatigue estimée à ${fatigue}/100 — athlète frais. Les conditions étaient réunies pour une bonne performance.`
    );
  }

  if (readiness >= 70) {
    lines.push(`Readiness estimé : ${readiness}/100 — l'athlète était prêt à performer.`);
  } else if (readiness < 50) {
    lines.push(`Readiness estimé : ${readiness}/100 — disponibilité physique limitée à cette date.`);
  }

  const activeInjuries = athlete.injuries?.filter((inj) => {
    if (inj.status === "résolu" || !inj.startDate) return false;
    const start    = parseLocalDate(inj.startDate);
    const end      = inj.endDate ? parseLocalDate(inj.endDate) : new Date(2099, 0, 1);
    const compDate = parseLocalDate(competition.date);
    return compDate >= start && compDate <= end;
  }) ?? [];

  if (activeInjuries.length > 0) {
    lines.push(
      `🩺 Blessure(s) active(s) à cette période : ${activeInjuries.map((i) => i.name).join(", ")}. ` +
      `À prendre en compte dans l'évaluation du résultat.`
    );
  }

  return lines;
}

export function athleteColor(athleteId, athletes) {
  const idx = athletes.findIndex((x) => x.id === athleteId);
  return ATHLETE_COLORS[idx % ATHLETE_COLORS.length];
}
