export const DASHBOARD_BLOCKS = [
  { key:"priorities", label:"Priorités du coach" },
  { key:"wellness", label:"Synthèse wellness" },
  { key:"overview", label:"Vue d’ensemble" },
  { key:"followup", label:"Suivi du groupe" },
];
export const DASHBOARD_CARDS = [
  { key:"athletes", label:"État des athlètes" },
  { key:"competitions", label:"Compétitions" },
  { key:"goals", label:"Objectifs saison" },
  { key:"feedback", label:"Feedbacks récents" },
];
const keys = DASHBOARD_BLOCKS.map(item => item.key);
const cardKeys = DASHBOARD_CARDS.map(item => item.key);
export function normalizeDashboardPreferences(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const order = Array.isArray(raw.order) ? [...new Set(raw.order.filter(key => keys.includes(key)))] : [];
  return {
    order:[...order, ...keys.filter(key => !order.includes(key))],
    hidden:Array.isArray(raw.hidden) ? [...new Set(raw.hidden.filter(key => [...keys,...cardKeys].includes(key)))] : [],
    defaultGroup:typeof raw.defaultGroup === "string" && raw.defaultGroup.trim() && raw.defaultGroup.length <= 120 ? raw.defaultGroup : null,
    feedbackDays:[7,14,28].includes(raw.feedbackDays) ? raw.feedbackDays : 7,
  };
}

// Presentation filter only. Authorization remains in Supabase RLS and module checks.
export function scopeDashboardData(data, group) {
  if (!group) return data;
  const athletes = data.athletes.filter(item => item.group === group);
  const ids = new Set(athletes.map(item => item.id));
  return {
    athletes,
    sessions:data.sessions.map(item => ({ ...item, athleteIds:item.athleteIds.filter(id => ids.has(id)), validations:item.validations.filter(row => ids.has(row.athleteId)) })).filter(item => item.athleteIds.length),
    competitions:data.competitions.map(item => ({ ...item, athleteIds:item.athleteIds.filter(id => ids.has(id)) })).filter(item => item.athleteIds.length),
    weeklyCharge:data.weeklyCharge.filter(item => ids.has(item.athleteId)),
    wellnessRows:data.wellnessRows.filter(item => ids.has(item.athleteId)),
    injuries:data.injuries.filter(item => ids.has(item.athleteId)),
    goals:data.goals.filter(item => ids.has(item.athlete_id)),
    alerts:data.alerts.filter(item => item.athlete_id == null || ids.has(item.athlete_id)),
  };
}
