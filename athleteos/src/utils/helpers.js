// ============================================================
// AthleteOS — src/utils/helpers.js
// Petits helpers génériques utilisés à la fois côté coach
// (src/modules) et côté athlète (src/athlete) — centralisés ici
// pour éviter les copies divergentes.
// ============================================================

export function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7 + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round((d - jan4) / (7 * 24 * 60 * 60 * 1000));
}

export function parseLocalDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
