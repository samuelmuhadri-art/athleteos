const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})/u;

export function civilDateKey(value) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const match = String(value ?? "").match(CIVIL_DATE);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function parseCivilDate(value) {
  const key = civilDateKey(value);
  if (!key) return null;
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatCivilDate(value, options = {}, locale = "fr-BE") {
  const date = parseCivilDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, options);
}

function zonedParts(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value;
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")) };
}

export function timestampDayKey(value, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const parts = zonedParts(value, timeZone);
  if (!parts) return null;
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function calendarDayDifference(older, newer, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const first = zonedParts(older, timeZone);
  const second = zonedParts(newer, timeZone);
  if (!first || !second) return null;
  const firstUtc = Date.UTC(first.year, first.month - 1, first.day);
  const secondUtc = Date.UTC(second.year, second.month - 1, second.day);
  return Math.round((secondUtc - firstUtc) / 86_400_000);
}

export function formatLocalTimestamp(value, options = {}, locale = "fr-BE", timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { ...options, ...(timeZone ? { timeZone } : {}) }).format(date);
}
