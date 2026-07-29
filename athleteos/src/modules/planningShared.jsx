// ============================================================
// AthleteOS — src/modules/planningShared.jsx
// Constantes et petits composants partagés entre Planning.jsx (coach),
// SessionModal.jsx et AddSessionModal.jsx — évite de les dupliquer.
// ============================================================

import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { getISOWeek, parseLocalDate } from "../utils/helpers.js";

export const DAYS_FR    = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
export const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
export const MONTHS_FR  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export const CATEGORIES = [
  { id: "sprint",       label: "Sprint"       },
  { id: "haies",        label: "Haies"        },
  { id: "force",        label: "Musculation"  },
  { id: "saut",         label: "Saut"         },
  { id: "lancer",       label: "Lancer"       },
  { id: "endurance",    label: "Endurance"    },
  { id: "technique",    label: "Technique"    },
  { id: "mobilite",     label: "Mobilité"     },
  { id: "recuperation", label: "Récupération" },
];

// Couleurs recalibrées pour le dark mode :
// - border = teinte saturée (accent visible)
// - text   = version claire de la teinte (lisible sur fond sombre)
// - bg     = utilisé uniquement en superposition ${border}1A/${border}22 (opacité faible)
export const SESSION_COLORS = {
  sprint:       { border: "#5B9EF5", text: "#A9CBFB", dot: "#5B9EF5" },
  haies:        { border: "#A78BFA", text: "#D2C4FB", dot: "#A78BFA" },
  force:        { border: "#34D399", text: "#9CF0D1", dot: "#34D399" },
  saut:         { border: "#C084FC", text: "#E3C6FD", dot: "#C084FC" },
  lancer:       { border: "#FB923C", text: "#FDCBA0", dot: "#FB923C" },
  endurance:    { border: "#38BDF8", text: "#A6E4FC", dot: "#38BDF8" },
  technique:    { border: "#94A3B8", text: "#D3D9E0", dot: "#94A3B8" },
  mobilite:     { border: "#EAB308", text: "#F7DD8B", dot: "#EAB308" },
  recuperation: { border: "#64748B", text: "#C2C9D2", dot: "#64748B" },
};

export const EMPTY_FORM = {
  title: "", type: "Sprint", category: "sprint", trainingFocus: "sprint_general",
  day: "Lundi", time: "10:00", durationMinutes: 60,
  description: "", instructions: "", athleteIds: [], sessionDate: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function dateToISOWeek(s) { return getISOWeek(parseLocalDate(s)); }
export function dateToDayName(s) { return DAYS_FR[(parseLocalDate(s).getDay()+6)%7]; }

// Convertit un Date en clé "YYYY-MM-DD" locale (jamais .toISOString() sur un
// Date local : ça convertit en UTC et décale le jour d'un cran dès que le
// fuseau est positif, ex. Belgique — une séance du 25 ressortait le 26).
export function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function sessionStatus(session) {
  const { validations, athleteIds } = session;
  if (!validations?.length) return "future";
  const done    = validations.filter(v => v.status === "done").length;
  const none    = validations.filter(v => v.status === "none").length;
  if (done === athleteIds.length && athleteIds.length > 0) return "done";
  if (none === athleteIds.length && athleteIds.length > 0) return "none";
  if (validations.filter(v => v.status === "partial").length > 0 || (done > 0 && done < athleteIds.length)) return "partial";
  return "future";
}

export function colors(category) {
  return SESSION_COLORS[category] ?? SESSION_COLORS.technique;
}

export function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const days = [];
  for (let i = startDow - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
  for (let d = 1; d <= lastDay.getDate(); d++) days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  const rem = 7 - (days.length % 7);
  if (rem < 7) for (let d = 1; d <= rem; d++) days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
  return days;
}

// ─── Statuts génériques (couleurs identiques quel que soit le thème) ─────────
const STATUS_COLORS = {
  done:    "#3DBE8B",
  partial: "#EAB308",
  none:    "#EF6B6B",
};

export function StatusIcon({ status, size = 14 }) {
  if (status === "done")    return <CheckCircle   size={size} color={STATUS_COLORS.done} />;
  if (status === "partial") return <AlertTriangle size={size} color={STATUS_COLORS.partial} />;
  if (status === "none")    return <XCircle       size={size} color={STATUS_COLORS.none} />;
  return null;
}

export function ValidationBadge({ status }) {
  const map = {
    done:    { label: "Réalisée",     bg: "rgba(61,190,139,0.14)", color: "#7BD8B4" },
    partial: { label: "Partielle",    bg: "rgba(234,179,8,0.14)",  color: "#F0CB61" },
    none:    { label: "Non réalisée", bg: "rgba(239,107,107,0.14)",color: "#F19A9A" },
  };
  const b = map[status] ?? { label: "À venir", bg: "var(--c-surface-3)", color: "var(--c-text-3)" };
  return (
    <span
      className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: b.bg, color: b.color }}
    >
      {b.label}
    </span>
  );
}
