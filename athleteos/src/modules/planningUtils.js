import { getISOWeek, parseLocalDate } from "../utils/helpers.js";

export const DAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const DAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export const CATEGORIES = [
  { id: "sprint", label: "Sprint" },
  { id: "haies", label: "Haies" },
  { id: "force", label: "Musculation" },
  { id: "saut", label: "Saut" },
  { id: "lancer", label: "Lancer" },
  { id: "endurance", label: "Endurance" },
  { id: "technique", label: "Technique" },
  { id: "mobilite", label: "Mobilité" },
  { id: "recuperation", label: "Récupération" },
];

export const SESSION_COLORS = {
  sprint: { border: "#5B9EF5", text: "#A9CBFB", dot: "#5B9EF5" },
  haies: { border: "#A78BFA", text: "#D2C4FB", dot: "#A78BFA" },
  force: { border: "#34D399", text: "#9CF0D1", dot: "#34D399" },
  saut: { border: "#C084FC", text: "#E3C6FD", dot: "#C084FC" },
  lancer: { border: "#FB923C", text: "#FDCBA0", dot: "#FB923C" },
  endurance: { border: "#38BDF8", text: "#A6E4FC", dot: "#38BDF8" },
  technique: { border: "#94A3B8", text: "#D3D9E0", dot: "#94A3B8" },
  mobilite: { border: "#EAB308", text: "#F7DD8B", dot: "#EAB308" },
  recuperation: { border: "#64748B", text: "#C2C9D2", dot: "#64748B" },
};

export const EMPTY_FORM = {
  title: "", type: "Sprint", category: "sprint", trainingFocus: "sprint_general",
  day: "Lundi", time: "10:00", durationMinutes: 60,
  description: "", instructions: "", athleteIds: [], sessionDate: "",
};

export function dateToISOWeek(value) { return getISOWeek(parseLocalDate(value)); }
export function dateToDayName(value) { return DAYS_FR[(parseLocalDate(value).getDay() + 6) % 7]; }

export function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isSameDay(first, second) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

export function sessionStatus(session) {
  const { validations, athleteIds } = session;
  if (!validations?.length) return "future";
  const done = validations.filter(validation => validation.status === "done").length;
  const none = validations.filter(validation => validation.status === "none").length;
  if (done === athleteIds.length && athleteIds.length > 0) return "done";
  if (none === athleteIds.length && athleteIds.length > 0) return "none";
  if (validations.some(validation => validation.status === "partial") || (done > 0 && done < athleteIds.length)) return "partial";
  return "future";
}

export function colors(category) {
  return SESSION_COLORS[category] ?? SESSION_COLORS.technique;
}

export function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const days = [];
  for (let index = startDow - 1; index >= 0; index--) days.push({ date: new Date(year, month, -index), isCurrentMonth: false });
  for (let day = 1; day <= lastDay.getDate(); day++) days.push({ date: new Date(year, month, day), isCurrentMonth: true });
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let day = 1; day <= remaining; day++) days.push({ date: new Date(year, month + 1, day), isCurrentMonth: false });
  }
  return days;
}
