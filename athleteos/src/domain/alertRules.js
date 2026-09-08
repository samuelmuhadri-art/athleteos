const numericField = (key, label, min, max, step = 1, suffix = "") => ({
  key, label, min, max, step, suffix,
});

export const ALERT_RULE_CATALOG = Object.freeze([
  {
    key:"wellness_missing", label:"Wellness non renseigné", moduleKey:"wellness",
    description:"Signale l’absence de réponse au questionnaire pendant la durée choisie.",
    fields:[numericField("days", "Après", 1, 14, 1, "jour(s)")], defaults:{ days:2 },
  },
  {
    key:"sleep_low", label:"Sommeil sous le seuil", moduleKey:"wellness",
    description:"Observe plusieurs réponses successives, sans interprétation médicale.",
    fields:[numericField("threshold", "Seuil maximal", 1, 4), numericField("consecutiveResponses", "Réponses successives", 1, 7)],
    defaults:{ threshold:2, consecutiveResponses:2 },
  },
  {
    key:"soreness_high", label:"Courbatures au-dessus du seuil", moduleKey:"wellness",
    description:"Observe plusieurs réponses successives avec des courbatures élevées.",
    fields:[numericField("threshold", "Seuil minimal", 2, 5), numericField("consecutiveResponses", "Réponses successives", 1, 7)],
    defaults:{ threshold:4, consecutiveResponses:2 },
  },
  {
    key:"feedback_missing", label:"Feedback de séance manquant", moduleKey:"session_feedback",
    description:"Repère une séance réalisée sans retour global de l’athlète.",
    fields:[numericField("daysAfter", "Délai", 1, 7, 1, "jour(s)")], defaults:{ daysAfter:1 },
  },
  {
    key:"rpe_missing", label:"RPE de séance manquant", moduleKey:"session_feedback",
    description:"Repère une séance réalisée dont le RPE n’a pas été renseigné.",
    fields:[numericField("daysAfter", "Délai", 1, 7, 1, "jour(s)")], defaults:{ daysAfter:1 },
  },
  {
    key:"competition_unplanned", label:"Compétition proche peu planifiée", moduleKey:"performances",
    description:"Compare une compétition à venir au nombre de séances déjà planifiées avant celle-ci.",
    fields:[numericField("daysBefore", "Horizon", 1, 42, 1, "jour(s)"), numericField("minimumPlannedSessions", "Minimum de séances", 1, 10)],
    defaults:{ daysBefore:14, minimumPlannedSessions:2 },
  },
  {
    key:"load_variation", label:"Variation de charge observée", moduleKey:"training_load",
    description:"Compare les 7 derniers jours à la moyenne des semaines précédentes, uniquement avec des charges complètes.",
    fields:[numericField("percent", "Variation minimale", 10, 100, 1, "%"), numericField("comparisonWeeks", "Semaines de référence", 2, 6)],
    defaults:{ percent:25, comparisonWeeks:4 },
  },
]);

export const ALERT_SEVERITIES = Object.freeze([
  { value:"info", label:"Information" },
  { value:"légère", label:"Légère" },
  { value:"modérée", label:"Modérée" },
  { value:"critique", label:"Critique" },
]);

export const ALERT_RECIPIENT_SCOPES = Object.freeze([
  { value:"staff", label:"Responsable et coachs" },
  { value:"head_coach", label:"Responsable uniquement" },
]);

const catalogByKey = new Map(ALERT_RULE_CATALOG.map(rule => [rule.key, rule]));
const validSeverities = new Set(ALERT_SEVERITIES.map(item => item.value));

function boundedNumber(value, field, fallback) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const stepped = Math.round(parsed / field.step) * field.step;
  return Math.min(field.max, Math.max(field.min, stepped));
}

export function normalizeAlertRule(value, catalogRule) {
  const source = value ?? {};
  return {
    key:catalogRule.key,
    enabled:source.enabled === true,
    parameters:Object.fromEntries(catalogRule.fields.map(field => [
      field.key,
      boundedNumber(source.parameters?.[field.key], field, catalogRule.defaults[field.key]),
    ])),
    targetGroup:typeof source.targetGroup === "string" && source.targetGroup.trim() ? source.targetGroup.trim().slice(0, 120) : null,
    severity:validSeverities.has(source.severity) ? source.severity : "modérée",
    recipientScope:source.recipientScope === "head_coach" ? "head_coach" : "staff",
    version:Number.isInteger(source.version) && source.version > 0 ? source.version : 1,
  };
}

export function normalizeAlertRules(values) {
  const sourceByKey = new Map((Array.isArray(values) ? values : []).map(rule => [rule?.key, rule]));
  return ALERT_RULE_CATALOG.map(rule => normalizeAlertRule(sourceByKey.get(rule.key), rule));
}

export function alertRuleCatalogItem(key) {
  return catalogByKey.get(key) ?? null;
}

export function alertRuleExplanation(alert) {
  const trigger = alert?.triggerData ?? alert?.trigger_data;
  if (!alert?.ruleKey && !alert?.rule_key) return null;
  const rule = alertRuleCatalogItem(alert.ruleKey ?? alert.rule_key);
  const since = trigger?.since ? new Date(`${trigger.since}T12:00:00`).toLocaleDateString("fr-BE") : null;
  return [rule?.label ?? "Règle configurée", since ? `observée depuis le ${since}` : null].filter(Boolean).join(" · ");
}
