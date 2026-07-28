// ============================================================
// AthleteOS — src/athlete/views/perfsShared.js
// Constantes et petits helpers partagés entre AthletePerfs.jsx et les
// fichiers extraits de son découpage (AddPerfModal, AddGoalModal,
// AddCompModal, PerfsWidgets) — évite de les dupliquer dans chacun.
//
// Tâche 9 : COMBINE_EVENTS et discColor délèguent maintenant au registre
// central (domain/disciplines.js) — signatures et formes inchangées pour
// ne rien casser côté appelants (COMBINE_EVENTS reste un objet indexable
// COMBINE_EVENTS[disc], discColor reste une fonction).
// ============================================================

import { COMBINE_EVENTS, getDisciplineColor, getDisciplineHib } from "../../domain/disciplines.js";

export { COMBINE_EVENTS };

export const discColor = (disc) => getDisciplineColor(disc);

// Indice visuel non plafonné : 100 = record de référence, >100 = record
// dépassé. Contrairement à pctOfReference(), il doit pouvoir afficher un
// objectif au-delà de 100 dans le graphique d'évolution.
export function performanceIndex(currentValue, referenceValue, discipline) {
  if (currentValue == null || referenceValue == null || currentValue === 0 || referenceValue === 0) return null;
  const ratio = getDisciplineHib(discipline)
    ? currentValue / referenceValue
    : referenceValue / currentValue;
  return Math.round(ratio * 1000) / 10;
}

// ─── Couleur selon la proximité au PR — même seuils que le classement groupe
// côté coach (Performances.jsx) : ≥97% optimal, ≥90% correct, en-dessous à
// travailler.
export function recordStatusColor(pct) {
  if (pct === null) return null;
  if (pct >= 97) return "#1D9E75";
  if (pct >= 90) return "#EF9F27";
  return "#E24B4A";
}
