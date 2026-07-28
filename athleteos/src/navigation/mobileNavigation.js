export const COACH_MOBILE_PRIMARY_ITEMS = Object.freeze([
  { id: "dashboard", label: "Accueil" },
  { id: "planning", label: "Planning" },
  { id: "athletes", label: "Athlètes" },
  { id: "messaging", label: "Messages" },
]);

export const COACH_MOBILE_MORE_ITEMS = Object.freeze([
  { id: "performances", label: "Performances", description: "Suivre les progrès" },
  { id: "charge", label: "Charge", description: "Prévenir la fatigue" },
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
