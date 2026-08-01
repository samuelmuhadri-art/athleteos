// ============================================================
// AthleteOS — src/utils/helpers.js
// Petits helpers génériques utilisés à la fois côté coach
// (src/modules) et côté athlète (src/athlete) — centralisés ici
// pour éviter les copies divergentes.
// ============================================================

export function getISOWeek(date) {
  return getISOWeekInfo(date).week;
}

export function getISOWeekYear(date) {
  return getISOWeekInfo(date).year;
}

export function getISOWeekInfo(date) {
  const localDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const isoDay = localDate.getUTCDay() || 7;
  const monday = new Date(localDate);
  monday.setUTCDate(monday.getUTCDate() - isoDay + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const d = new Date(localDate);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7 + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return {
    week: 1 + Math.round((d - jan4) / (7 * 24 * 60 * 60 * 1000)),
    year: d.getUTCFullYear(),
    startDate: monday.toISOString().slice(0, 10),
    endDate: sunday.toISOString().slice(0, 10),
  };
}

export function parseLocalDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function matchesISOWeek(row, week, year) {
  if (!row) return false;
  const explicitYear = Number(row.isoYear ?? row.iso_year);
  const explicitWeek = Number(row.week);
  if (Number.isInteger(explicitWeek) && explicitWeek !== week) return false;
  if (Number.isInteger(explicitYear)) {
    return explicitYear === year && (!Number.isInteger(explicitWeek) || explicitWeek === week);
  }

  const dateValue = row.sessionDate ?? row.session_date ?? row.date ?? row.loadDate ?? row.load_date;
  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
    const info = getISOWeekInfo(parseLocalDate(dateValue.slice(0, 10)));
    return info.week === week && info.year === year;
  }
  return Number.isInteger(explicitWeek) && explicitWeek === week;
}

export function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
