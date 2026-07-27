// ============================================================
// AthleteOS — src/athlete/views/perfsShared.js
// Constantes et petits helpers partagés entre AthletePerfs.jsx et les
// fichiers extraits de son découpage (AddPerfModal, AddGoalModal,
// AddCompModal, PerfsWidgets) — évite de les dupliquer dans chacun.
// ============================================================

// Détail par épreuve — disponible uniquement pour les disciplines combinées.
// Ordre officiel des épreuves (jour 1 puis jour 2).
export const COMBINE_EVENTS = {
  "Décathlon":  ["100m", "Longueur", "Poids", "Hauteur", "400m", "110m haies", "Disque", "Perche", "Javelot", "1500m"],
  "Heptathlon": ["100m haies", "Hauteur", "Poids", "200m", "Longueur", "Javelot", "800m"],
};

// ─── Couleurs par discipline (accents vifs, faits pour fond sombre) ──────────
const DISC_COLORS = {
  "100m":       "#5B9EF5", "200m":       "#A78BFA", "400m":       "#F0CB61",
  "800m":       "#EF6B6B", "1500m":      "#EC4899", "3000m":      "#38BDF8",
  "110m haies": "#EF6B6B", "100m haies": "#EC4899", "400m haies": "#FB923C",
  "Longueur":   "#34D399", "Triple saut":"#14B8A6", "Hauteur":    "#FB923C",
  "Perche":     "#6366F1", "Poids":      "#A3E635", "Disque":     "#C084FC",
  "Javelot":    "#FB923C", "Marteau":    "#34D399",
};
export const discColor = (disc) => DISC_COLORS[disc] ?? "#1D9E75";

// ─── Couleur selon la proximité au PR — même seuils que le classement groupe
// côté coach (Performances.jsx) : ≥97% optimal, ≥90% correct, en-dessous à
// travailler.
export function recordStatusColor(pct) {
  if (pct === null) return null;
  if (pct >= 97) return "#1D9E75";
  if (pct >= 90) return "#EF9F27";
  return "#E24B4A";
}
