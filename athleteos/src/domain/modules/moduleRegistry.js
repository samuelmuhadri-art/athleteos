export const MODULE_KEYS = Object.freeze([
  "planning",
  "performances",
  "session_feedback",
  "wellness",
  "training_load",
  "health",
  "messaging",
  "social",
  "reports",
]);

export const MODULE_REGISTRY = Object.freeze({
  planning: {
    label: "Planning",
    shortLabel: "Planning",
    description: "Planifier les séances et partager les consignes.",
    group: "training",
  },
  performances: {
    label: "Performances & compétitions",
    shortLabel: "Performances",
    description: "Suivre les résultats, records, objectifs et compétitions.",
    group: "progress",
  },
  session_feedback: {
    label: "Feedback de séance",
    shortLabel: "Feedback",
    description: "Recueillir présence, ressenti, durée réelle, RPE et commentaire.",
    group: "monitoring",
  },
  wellness: {
    label: "Bien-être quotidien",
    shortLabel: "Bien-être",
    description: "Suivre sommeil, énergie, fatigue, humeur et stress.",
    group: "monitoring",
  },
  training_load: {
    label: "Charge d’entraînement",
    shortLabel: "Charge",
    description: "Afficher les analyses de charge existantes et leurs alertes.",
    group: "monitoring",
    dependsOn: ["session_feedback"],
  },
  health: {
    label: "Santé & blessures",
    shortLabel: "Santé",
    description: "Centraliser les douleurs, blessures et suivis de reprise.",
    group: "monitoring",
  },
  messaging: {
    label: "Messagerie",
    shortLabel: "Messagerie",
    description: "Échanger directement entre coachs et athlètes.",
    group: "communication",
  },
  social: {
    label: "Vie du club",
    shortLabel: "Club",
    description: "Partager les actualités, photos et réactions du groupe.",
    group: "communication",
  },
  reports: {
    label: "Rapports",
    shortLabel: "Rapports",
    description: "Composer des synthèses uniquement avec les données activées.",
    group: "progress",
  },
});

export const MODULE_GROUPS = Object.freeze([
  { id: "training", label: "Organisation" },
  { id: "progress", label: "Progression" },
  { id: "monitoring", label: "Suivi individuel" },
  { id: "communication", label: "Communication" },
]);

export const MODULE_PRESETS = Object.freeze([
  {
    id: "essential",
    label: "Essentiel",
    description: "Planning, performances et messagerie.",
    moduleKeys: ["planning", "performances", "messaging"],
  },
  {
    id: "balanced",
    label: "Suivi équilibré",
    description: "Ajoute feedback, bien-être, santé et rapports.",
    moduleKeys: ["planning", "performances", "session_feedback", "wellness", "health", "messaging", "reports"],
  },
  {
    id: "complete",
    label: "Suivi complet",
    description: "Tous les outils AthleteOS, y compris la charge et la vie du club.",
    moduleKeys: MODULE_KEYS,
  },
]);

export const COACH_VIEW_MODULE = Object.freeze({
  planning: "planning",
  performances: "performances",
  competitions: "performances",
  charge: "training_load",
  rapports: "reports",
  messaging: "messaging",
});

export const ATHLETE_VIEW_MODULE = Object.freeze({
  planning: "planning",
  performances: "performances",
  social: "social",
  messagerie: "messaging",
});

export function normalizeModuleKeys(keys, availableKeys = MODULE_KEYS) {
  const allowed = new Set(availableKeys);
  return [...new Set((keys ?? []).filter((key) => allowed.has(key)))];
}

export function resolveModuleDependencies(keys, availableKeys = MODULE_KEYS) {
  const enabled = new Set(normalizeModuleKeys(keys, availableKeys));
  let changed = true;
  while (changed) {
    changed = false;
    [...enabled].forEach((key) => {
      (MODULE_REGISTRY[key]?.dependsOn ?? []).forEach((dependency) => {
        if (availableKeys.includes(dependency) && !enabled.has(dependency)) {
          enabled.add(dependency);
          changed = true;
        }
      });
    });
  }
  return availableKeys.filter((key) => enabled.has(key));
}

export function toggleModule(keys, moduleKey, enabled, availableKeys = MODULE_KEYS) {
  const next = new Set(normalizeModuleKeys(keys, availableKeys));
  if (enabled) {
    next.add(moduleKey);
    return resolveModuleDependencies([...next], availableKeys);
  }
  next.delete(moduleKey);
  availableKeys.forEach((key) => {
    if ((MODULE_REGISTRY[key]?.dependsOn ?? []).includes(moduleKey)) next.delete(key);
  });
  return availableKeys.filter((key) => next.has(key));
}

export function rowsToModuleMap(rows, defaultEnabled = true) {
  const result = Object.fromEntries(MODULE_KEYS.map((key) => [key, defaultEnabled]));
  (rows ?? []).forEach((row) => {
    if (MODULE_REGISTRY[row.module_key]) result[row.module_key] = row.enabled !== false;
  });
  return result;
}

export function resolveEffectiveModules(clubModules, athleteModules = {}) {
  return Object.fromEntries(MODULE_KEYS.map((key) => [
    key,
    clubModules?.[key] !== false && athleteModules?.[key] !== false,
  ]));
}

export function filterNavigation(items, moduleMap, viewRequirements) {
  return items.filter((item) => {
    const required = viewRequirements[item.id];
    return !required || moduleMap?.[required] !== false;
  });
}

export function moduleKeyForEventType(type) {
  if (["new_session", "session_updated", "session_day_reminder", "session_response", "athlete_session"].includes(type)) return "planning";
  if (["session_feedback_reminder", "weekly_recap", "recap", "absence"].includes(type)) return "session_feedback";
  if (["result_added", "goal_achieved", "competition_reminder", "competition", "performance"].includes(type)) return "performances";
  if (type === "weekly_report") return "reports";
  if (type === "message") return "messaging";
  if (["social_post", "social"].includes(type)) return "social";
  if (["blessure", "injury"].includes(type)) return "health";
  if (type === "wellness") return "wellness";
  if (["charge", "load", "acwr"].includes(type)) return "training_load";
  return null;
}
