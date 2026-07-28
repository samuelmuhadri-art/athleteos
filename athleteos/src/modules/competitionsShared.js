// ============================================================
// AthleteOS — src/modules/competitionsShared.js
// Constantes et helpers partagés entre Competitions.jsx, CompCard.jsx,
// CompModal.jsx, CreateCompModal.jsx et AddResultInline.jsx.
// ============================================================

import { getAthleteMetricsForWeek } from "../utils/chargeCalculations.js";
// Tâche 11 : moteur central de comparaison de performances — ce fichier
// avait sa PROPRE copie de parsePerf() qui devinait le sens ("higherIsBetter")
// depuis le FORMAT de la chaîne plutôt que depuis la discipline (un lancer
// de poids "14.20" sans "m" était pris pour un chrono). isNewRecord()
// décide si un résultat de compétition écrase le PR en base — une mauvaise
// détection ici corrompait silencieusement les records. Remplacée par
// athlete/shared.js, seule source de vérité.
import { parsePerf, getDiscHib } from "../athlete/shared.js";

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
  return new Date(dateStr).toLocaleDateString("fr-BE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    ...opts,
  });
}

export function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString("fr-BE", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function dateToWeek(dateStr) {
  const d    = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
}

export function isNewRecord(newResult, existingPr, discipline) {
  if (!existingPr) return true;
  const a = parsePerf(newResult);
  const b = parsePerf(existingPr);
  if (a.value === null || b.value === null) return false;
  return getDiscHib(discipline) ? a.value > b.value : a.value < b.value;
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
    const start    = new Date(inj.startDate);
    const end      = inj.endDate ? new Date(inj.endDate) : new Date("2099-01-01");
    const compDate = new Date(competition.date);
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
