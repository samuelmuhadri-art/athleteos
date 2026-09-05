export const COACH_MOBILE_PRIMARY_ITEMS = Object.freeze([
  { id: "dashboard", label: "Accueil" },
  { id: "planning", label: "Planning" },
  { id: "athletes", label: "Athlètes" },
  { id: "messaging", label: "Messages" },
]);

export const COACH_MOBILE_MORE_ITEMS = Object.freeze([
  { id: "performances", label: "Performances", description: "Suivre les progrès" },
  { id: "charge", label: "Charge", description: "Comprendre l'entraînement" },
  { id: "competitions", label: "Compétitions", description: "Préparer les échéances" },
  { id: "alerts", label: "Alertes", description: "Voir les signaux à traiter" },
  { id: "rapports", label: "Rapports", description: "Consulter les synthèses du club" },
]);

export const ATHLETE_MOBILE_ITEM_IDS = Object.freeze([
  "dashboard",
  "planning",
  "performances",
  "social",
  "messagerie",
]);

export function isCoachMoreView(viewId) {
  return COACH_MOBILE_MORE_ITEMS.some((item) => item.id === viewId);
}

// Fill available places without adding a sixth touch target or duplicating a route.
export function buildCoachMobileNavigation(primaryItems, secondaryItems) {
  const combined = [...primaryItems, ...secondaryItems];
  if (combined.length <= 5) return { primary: combined, more: [] };
  const promotedCount = Math.max(0, 4 - primaryItems.length);
  return {
    primary: [...primaryItems, ...secondaryItems.slice(0, promotedCount)],
    more: secondaryItems.slice(promotedCount),
  };
}
