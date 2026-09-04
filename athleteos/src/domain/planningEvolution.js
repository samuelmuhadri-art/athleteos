import { civilDateKey, parseCivilDate } from "../utils/dateTime";

export const RECURRENCE_OPTIONS = [
  { id: "none", label: "Aucune" },
  { id: "weekly", label: "Chaque semaine", intervalWeeks: 1 },
  { id: "biweekly", label: "Toutes les 2 semaines", intervalWeeks: 2 },
];

export const SESSION_PROVENANCE = {
  individual: "Séance individuelle",
  group: "Séance de groupe",
  series: "Série hebdomadaire",
  group_series: "Série de groupe",
  exception: "Exception individuelle",
  duplicate: "Séance dupliquée",
  template: "Créée depuis un modèle",
};

export function isoWeekday(value) {
  const date = parseCivilDate(value);
  if (!date) return null;
  return date.getDay() === 0 ? 7 : date.getDay();
}

export function generateRecurrenceDates({ startsOn, endsOn, occurrenceCount, intervalWeeks = 1, weekdays = [] }) {
  const start = parseCivilDate(startsOn);
  const end = endsOn ? parseCivilDate(endsOn) : null;
  const max = occurrenceCount ? Math.min(104, Math.max(1, Number(occurrenceCount))) : 104;
  const selectedDays = new Set([...new Set(weekdays.map(Number))].filter(day => day >= 1 && day <= 7));
  if (!start || selectedDays.size === 0 || ![1, 2].includes(Number(intervalWeeks))) return [];
  if (!end && !occurrenceCount) return [];

  const hardEnd = end ?? new Date(start.getFullYear() + 2, start.getMonth(), start.getDate());
  const result = [];
  for (const cursor = new Date(start); cursor <= hardEnd && result.length < max; cursor.setDate(cursor.getDate() + 1)) {
    const elapsedDays = Math.round((new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()) - start) / 86_400_000);
    const elapsedWeeks = Math.floor(elapsedDays / 7);
    if (selectedDays.has(cursor.getDay() === 0 ? 7 : cursor.getDay()) && elapsedWeeks % Number(intervalWeeks) === 0) {
      result.push(civilDateKey(cursor));
    }
  }
  return result;
}

export function groupAthletes(athletes = []) {
  const groups = new Map();
  athletes.forEach(athlete => {
    const name = String(athlete.group ?? athlete.groupName ?? "").trim();
    if (!name) return;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(athlete);
  });
  return [...groups.entries()]
    .map(([name, members]) => ({ name, members, athleteIds: members.map(member => member.id) }))
    .sort((first, second) => first.name.localeCompare(second.name, "fr"));
}

export function mergeTargetSelection(currentIds = [], targetIds = [], selected = true) {
  const merged = new Set(currentIds);
  targetIds.forEach(id => selected ? merged.add(id) : merged.delete(id));
  return [...merged];
}

export function buildDuplicateForm(session, sessionDate) {
  return {
    title: session.title,
    type: session.type,
    category: session.category,
    trainingFocus: session.trainingFocus,
    durationMinutes: session.durationMinutes,
    description: session.description ?? "",
    instructions: session.instructions ?? "",
    athleteIds: [...(session.athleteIds ?? [])],
    sessionDate,
    documentIds: (session.documents ?? []).map(document => document.id),
  };
}
