// ============================================================
// AthleteOS — src/domain/disciplines.js
//
// Registre central des disciplines d'athlétisme (tâche 9). Un seul
// endroit qui décrit chaque discipline : identifiant, libellé, type,
// unité de mesure, sens de comparaison (higherIsBetter), précision
// d'affichage, format de saisie, alias connus et sous-épreuves pour les
// combinées.
//
// Remplace les définitions dupliquées qui existaient avant cette tâche :
//   - athlete/shared.js         : DISC_PRESETS, DISC_TYPE_COLORS
//   - athlete/views/perfsShared.js : DISC_COLORS, COMBINE_EVENTS
// Ces deux fichiers réexportent maintenant depuis ici (voir leurs
// commentaires) — aucun appelant existant n'a eu besoin de changer son
// import.
//
// Décision (irréversible dans son principe, documentée) : l'IDENTIFIANT
// CANONIQUE d'une discipline = son libellé affiché actuel (ex: "100m",
// "Longueur"). Ces chaînes exactes sont déjà celles stockées telles
// quelles depuis le début du projet dans athlete_performances.discipline,
// records.discipline, athlete_goals.discipline et
// competition_results.event. Introduire un identifiant DIFFÉRENT du
// libellé (ex: un slug "sprint_100m") demanderait de migrer l'historique
// dans 4 tables — hors périmètre de cette tâche, qui porte sur le
// registre en mémoire, pas sur un changement de schéma. "Stable" ici veut
// dire : ce nom ne doit plus jamais changer une fois utilisé quelque
// part, exactement comme c'était déjà le cas implicitement.
// ============================================================

export const MEASUREMENT_TYPE = {
  TIME: "time",
  DISTANCE: "distance",
  POINTS: "points",
  UNKNOWN: "unknown",
};

export const PERFORMANCE_DIRECTION = { LOWER: "lower", HIGHER: "higher", UNKNOWN: "unknown" };
export const VENUE_TYPE = { INDOOR: "indoor", OUTDOOR: "outdoor", ROAD: "road", UNKNOWN: "unknown" };
export const TIMING_METHOD = {
  FULLY_AUTOMATIC: "fully_automatic", HAND: "hand", TRANSPONDER: "transponder",
  UNKNOWN: "unknown", NOT_APPLICABLE: "not_applicable",
};
export const OFFICIAL_STATUS = { OFFICIAL: "official", UNOFFICIAL: "unofficial", UNKNOWN: "unknown" };
export const PERFORMANCE_METADATA_VERSION = "athleteos-performance-v1";
export const SCORING_TABLE_VERSIONS = {
  GENERAL: "WA_SCORING_TABLES_2025",
  COMBINED: "IAAF_COMBINED_EVENTS_2012",
};

// Détermine le format de SAISIE/PARSING attendu (voir parsePerf dans
// athlete/shared.js) :
//   "seconds" : "11.20"           (chrono court, secondes.centièmes)
//   "minutes" : "4:32"            (chrono long, minutes:secondes)
//   "meters"  : "7.60"            (distance, éventuellement suivi de "m")
//   "points"  : "7845"            (total combinée)
export const INPUT_FORMAT = {
  SECONDS: "seconds",
  MINUTES: "minutes",
  METERS: "meters",
  POINTS: "points",
};

const TIME_SHORT = {
  type: null, measurementType: MEASUREMENT_TYPE.TIME, unit: "s",
  higherIsBetter: false, decimals: 2, inputFormat: INPUT_FORMAT.SECONDS,
  environments: [VENUE_TYPE.INDOOR, VENUE_TYPE.OUTDOOR],
  timingMethods: [TIMING_METHOD.FULLY_AUTOMATIC, TIMING_METHOD.HAND],
};
const TIME_LONG = {
  type: null, measurementType: MEASUREMENT_TYPE.TIME, unit: "s",
  higherIsBetter: false, decimals: 2, inputFormat: INPUT_FORMAT.MINUTES,
  environments: [VENUE_TYPE.INDOOR, VENUE_TYPE.OUTDOOR],
  timingMethods: [TIMING_METHOD.FULLY_AUTOMATIC, TIMING_METHOD.HAND],
};
const DISTANCE = {
  type: null, measurementType: MEASUREMENT_TYPE.DISTANCE, unit: "m",
  higherIsBetter: true, decimals: 2, inputFormat: INPUT_FORMAT.METERS,
  environments: [VENUE_TYPE.INDOOR, VENUE_TYPE.OUTDOOR],
  timingMethods: [TIMING_METHOD.NOT_APPLICABLE],
};
const POINTS = {
  type: "combine", measurementType: MEASUREMENT_TYPE.POINTS, unit: "pts",
  higherIsBetter: true, decimals: 0, inputFormat: INPUT_FORMAT.POINTS,
  environments: [VENUE_TYPE.INDOOR, VENUE_TYPE.OUTDOOR],
  timingMethods: [TIMING_METHOD.NOT_APPLICABLE],
  scoringTableVersion: SCORING_TABLE_VERSIONS.COMBINED,
};

// Ordre officiel des épreuves d'une combinée (jour 1 puis jour 2) —
// déplacé tel quel depuis perfsShared.js (COMBINE_EVENTS).
const DECATHLON_EVENTS  = ["100m", "Longueur", "Poids", "Hauteur", "400m", "110m haies", "Disque", "Perche", "Javelot", "1500m"];
const HEPTATHLON_EVENTS = ["100m haies", "Hauteur", "Poids", "200m", "Longueur", "Javelot", "800m"];

export const DISCIPLINES = {
  "100m":        { label: "100m",        ...TIME_SHORT, type: "sprint",    color: "#5B9EF5", aliases: ["100 m", "100 metres", "100m."] },
  "200m":        { label: "200m",        ...TIME_SHORT, type: "sprint",    color: "#A78BFA", aliases: ["200 m"] },
  "400m":        { label: "400m",        ...TIME_SHORT, type: "sprint",    color: "#F0CB61", aliases: ["400 m"] },
  "800m":        { label: "800m",        ...TIME_LONG,  type: "endurance", color: "#EF6B6B", aliases: ["800 m"] },
  "1500m":       { label: "1500m",       ...TIME_LONG,  type: "endurance", color: "#EC4899", aliases: ["1500 m", "1 500m"] },
  "3000m":       { label: "3000m",       ...TIME_LONG,  type: "endurance", color: "#38BDF8", aliases: ["3000 m", "3 000m"] },
  "60m haies":   { label: "60m haies",   ...TIME_SHORT, type: "sprint",    color: "#5B9EF5", aliases: ["60 m haies", "60m hurdles"] },
  "100m haies":  { label: "100m haies",  ...TIME_SHORT, type: "sprint",    color: "#EC4899", aliases: ["100 m haies"] },
  "110m haies":  { label: "110m haies",  ...TIME_SHORT, type: "sprint",    color: "#EF6B6B", aliases: ["110 m haies"] },
  "400m haies":  { label: "400m haies",  ...TIME_SHORT, type: "sprint",    color: "#FB923C", aliases: ["400 m haies"] },
  "Longueur":    { label: "Longueur",    ...DISTANCE,   type: "saut",      color: "#34D399", aliases: ["Saut en longueur"] },
  "Triple saut": { label: "Triple saut", ...DISTANCE,   type: "saut",      color: "#14B8A6", aliases: [] },
  "Hauteur":     { label: "Hauteur",     ...DISTANCE,   type: "saut",      color: "#FB923C", aliases: ["Saut en hauteur"] },
  "Perche":      { label: "Perche",      ...DISTANCE,   type: "saut",      color: "#6366F1", aliases: ["Saut à la perche"] },
  "Poids":       { label: "Poids",       ...DISTANCE,   type: "lancer",    color: "#A3E635", aliases: ["Lancer de poids"] },
  "Disque":      { label: "Disque",      ...DISTANCE,   type: "lancer",    color: "#C084FC", aliases: ["Lancer de disque"] },
  "Javelot":     { label: "Javelot",     ...DISTANCE,   type: "lancer",    color: "#FB923C", aliases: ["Lancer de javelot"] },
  "Marteau":     { label: "Marteau",     ...DISTANCE,   type: "lancer",    color: "#34D399", aliases: ["Lancer de marteau"] },
  "Décathlon":   { label: "Décathlon",   ...POINTS,     color: "#CA8A04", aliases: ["Decathlon"], subEvents: DECATHLON_EVENTS },
  "Heptathlon":  { label: "Heptathlon",  ...POINTS,     color: "#CA8A04", aliases: [], subEvents: HEPTATHLON_EVENTS },
};

// Contexte technique nécessaire à l'interprétation d'un résultat. Ces
// champs décrivent les conditions ; ils ne valident jamais seuls une perf.
const WIND_EVENTS = new Set(["100m", "200m", "60m haies", "100m haies", "110m haies", "Longueur", "Triple saut"]);
const HURDLE_EVENTS = new Set(["60m haies", "100m haies", "110m haies", "400m haies"]);
const THROW_EVENTS = new Set(["Poids", "Disque", "Javelot", "Marteau"]);

for (const [id, discipline] of Object.entries(DISCIPLINES)) {
  discipline.performanceDirection = discipline.higherIsBetter
    ? PERFORMANCE_DIRECTION.HIGHER
    : PERFORMANCE_DIRECTION.LOWER;
  discipline.windMeasurement = WIND_EVENTS.has(id) ? "required_for_official_review" : "not_applicable";
  discipline.requiresHurdleHeight = HURDLE_EVENTS.has(id);
  discipline.requiresImplementWeight = THROW_EVENTS.has(id);
  discipline.scoringTableVersion ??= SCORING_TABLE_VERSIONS.GENERAL;
  discipline.catalogVersion = PERFORMANCE_METADATA_VERSION;
}

export const DISCIPLINE_TYPE_COLORS = {
  sprint:    { bg: "#DBEAFE", border: "#3B82F6", text: "#1D4ED8", dot: "#3B82F6" },
  endurance: { bg: "#E0F2FE", border: "#0284C7", text: "#0C4A6E", dot: "#0284C7" },
  saut:      { bg: "#F3E8FF", border: "#A855F7", text: "#6B21A8", dot: "#A855F7" },
  lancer:    { bg: "#FFEDD5", border: "#F97316", text: "#9A3412", dot: "#F97316" },
  combine:   { bg: "#FEF9C3", border: "#CA8A04", text: "#713F12", dot: "#CA8A04" },
};

const DEFAULT_DISCIPLINE_COLOR = "#1D9E75";

// Discipline personnalisée / inconnue (nom tapé librement par un coach ou
// un athlète, jamais ajouté au registre officiel) : ne doit JAMAIS faire
// planter l'app. Ces valeurs par défaut reproduisent exactement le
// comportement déjà en place avant cette tâche (getDiscType -> "sprint",
// getDiscHib -> false), pour ne rien changer au jugement porté sur les
// disciplines déjà utilisées en pratique par les clubs.
const UNKNOWN_DISCIPLINE_DEFAULTS = {
  type: "custom", measurementType: MEASUREMENT_TYPE.UNKNOWN, unit: null,
  higherIsBetter: null, performanceDirection: PERFORMANCE_DIRECTION.UNKNOWN,
  decimals: 2, inputFormat: INPUT_FORMAT.METERS,
  environments: [VENUE_TYPE.UNKNOWN], timingMethods: [TIMING_METHOD.UNKNOWN],
  windMeasurement: "unknown", requiresHurdleHeight: false,
  requiresImplementWeight: false, scoringTableVersion: null,
  catalogVersion: PERFORMANCE_METADATA_VERSION,
};

function normalizeKey(s) {
  return s.toString().trim().toLowerCase().replace(/\s+/g, " ");
}

// ─── Index des alias (construit une fois, au chargement du module) ────────
// Toute collision (deux disciplines revendiquant la même clé normalisée)
// est enregistrée plutôt qu'écrasée silencieusement — voir
// validateRegistry() plus bas, qui l'expose pour être testée.
const ALIAS_INDEX = new Map();
const ALIAS_COLLISIONS = [];
for (const [id, disc] of Object.entries(DISCIPLINES)) {
  const keys = [id, ...(disc.aliases ?? [])];
  for (const key of keys) {
    const norm = normalizeKey(key);
    if (ALIAS_INDEX.has(norm) && ALIAS_INDEX.get(norm) !== id) {
      ALIAS_COLLISIONS.push({ key: norm, claimedBy: [ALIAS_INDEX.get(norm), id] });
      continue; // garde le premier mapping, ne pas écraser silencieusement
    }
    ALIAS_INDEX.set(norm, id);
  }
}

// Résout un texte saisi (identifiant officiel, alias connu, ou simple
// variation d'espacement/casse — "100 m" / "100M" / " 100m ") vers
// l'identifiant canonique. Une discipline personnalisée qui ne correspond
// à rien de connu est renvoyée telle quelle (trim uniquement) : le
// registre officiel n'est jamais "cassé" ni pollué par une saisie libre.
export function resolveDisciplineId(rawText) {
  if (rawText == null) return rawText;
  const trimmed = rawText.toString().trim();
  if (!trimmed) return trimmed;
  return ALIAS_INDEX.get(normalizeKey(trimmed)) ?? trimmed;
}

// Fiche complète d'une discipline (résout les alias), ou null si inconnue.
export function getDiscipline(rawText) {
  if (!rawText) return null;
  const id = resolveDisciplineId(rawText);
  return DISCIPLINES[id] ?? null;
}

export function getDisciplineType(rawText) {
  return getDiscipline(rawText)?.type ?? UNKNOWN_DISCIPLINE_DEFAULTS.type;
}

export function getDisciplineHib(rawText) {
  return getDiscipline(rawText)?.higherIsBetter ?? UNKNOWN_DISCIPLINE_DEFAULTS.higherIsBetter;
}

export function getDisciplineDirection(rawText) {
  return getDiscipline(rawText)?.performanceDirection ?? UNKNOWN_DISCIPLINE_DEFAULTS.performanceDirection;
}

export function getDisciplineUnit(rawText) {
  return getDiscipline(rawText)?.unit ?? UNKNOWN_DISCIPLINE_DEFAULTS.unit;
}

export function getDisciplineMeasurementType(rawText) {
  return getDiscipline(rawText)?.measurementType ?? UNKNOWN_DISCIPLINE_DEFAULTS.measurementType;
}

export function getDisciplineDecimals(rawText) {
  return getDiscipline(rawText)?.decimals ?? UNKNOWN_DISCIPLINE_DEFAULTS.decimals;
}

export function getDisciplineInputFormat(rawText) {
  return getDiscipline(rawText)?.inputFormat ?? UNKNOWN_DISCIPLINE_DEFAULTS.inputFormat;
}

export function getDisciplineColor(rawText) {
  const id = resolveDisciplineId(rawText);
  return DISCIPLINES[id]?.color ?? DEFAULT_DISCIPLINE_COLOR;
}

// Sous-épreuves d'une combinée (Décathlon/Heptathlon), ou null pour toute
// autre discipline (y compris personnalisée).
export function getDisciplineSubEvents(rawText) {
  return getDiscipline(rawText)?.subEvents ?? null;
}

export function getAllDisciplineIds() {
  return Object.keys(DISCIPLINES);
}

export function createPerformanceMetadata(rawText, overrides = {}) {
  const discipline = getDiscipline(rawText) ?? UNKNOWN_DISCIPLINE_DEFAULTS;
  return {
    measurement_type: discipline.measurementType,
    performance_direction: discipline.performanceDirection,
    unit: discipline.unit,
    venue_type: VENUE_TYPE.UNKNOWN,
    wind_mps: null,
    timing_method: discipline.measurementType === MEASUREMENT_TYPE.TIME
      ? TIMING_METHOD.UNKNOWN
      : TIMING_METHOD.NOT_APPLICABLE,
    implement_weight_kg: null,
    hurdle_height_m: null,
    official_status: OFFICIAL_STATUS.UNKNOWN,
    scoring_table_version: discipline.scoringTableVersion,
    metadata_version: PERFORMANCE_METADATA_VERSION,
    ...overrides,
  };
}

export function normalizePerformanceMetadata(rawText, metadata = {}) {
  const discipline = getDiscipline(rawText);
  const defaults = createPerformanceMetadata(rawText);
  const merged = { ...defaults, ...metadata };
  if (discipline) {
    merged.measurement_type = defaults.measurement_type;
    merged.performance_direction = defaults.performance_direction;
    merged.unit = defaults.unit;
    merged.scoring_table_version = defaults.scoring_table_version;
    merged.metadata_version = defaults.metadata_version;
  }
  const numberOrNull = (value) => value === "" || value == null ? null : Number(value);
  return {
    ...merged,
    wind_mps: numberOrNull(merged.wind_mps),
    implement_weight_kg: numberOrNull(merged.implement_weight_kg),
    hurdle_height_m: numberOrNull(merged.hurdle_height_m),
  };
}

export function validatePerformanceMetadata(rawText, metadata = {}) {
  const discipline = getDiscipline(rawText);
  const normalized = normalizePerformanceMetadata(rawText, metadata);
  const issues = [];
  if (!discipline && ![PERFORMANCE_DIRECTION.HIGHER, PERFORMANCE_DIRECTION.LOWER].includes(normalized.performance_direction)) {
    issues.push("Indique si une valeur plus haute ou plus basse est meilleure.");
  }
  if (!discipline && ![MEASUREMENT_TYPE.TIME, MEASUREMENT_TYPE.DISTANCE, MEASUREMENT_TYPE.POINTS].includes(normalized.measurement_type)) {
    issues.push("Indique le type de mesure de cette épreuve personnalisée.");
  }
  if (!discipline && !normalized.unit?.trim()) issues.push("Indique l'unité de cette épreuve personnalisée.");
  if (!Object.values(VENUE_TYPE).includes(normalized.venue_type)) issues.push("Environnement invalide.");
  if (!Object.values(OFFICIAL_STATUS).includes(normalized.official_status)) issues.push("Statut officiel invalide.");
  if (normalized.wind_mps != null && !Number.isFinite(normalized.wind_mps)) issues.push("Vent invalide.");
  if (normalized.implement_weight_kg != null && !(normalized.implement_weight_kg > 0)) issues.push("Poids de l'engin invalide.");
  if (normalized.hurdle_height_m != null && !(normalized.hurdle_height_m > 0)) issues.push("Hauteur des haies invalide.");
  return issues;
}

// { "Décathlon": [...], "Heptathlon": [...] } — forme objet pratique pour
// un lookup direct `COMBINE_EVENTS[disc]` (compat perfsShared.js).
export const COMBINE_EVENTS = Object.fromEntries(
  Object.entries(DISCIPLINES).filter(([, d]) => d.subEvents).map(([id, d]) => [id, d.subEvents])
);

const REQUIRED_FIELDS = ["label", "type", "measurementType", "unit", "higherIsBetter", "performanceDirection", "decimals", "inputFormat", "color", "environments", "timingMethods", "windMeasurement", "requiresImplementWeight", "requiresHurdleHeight", "scoringTableVersion", "catalogVersion"];

// Auto-vérification du registre — utilisée par test_discipline_registry.mjs,
// mais exportée (pas juste un script ponctuel) pour pouvoir être rappelée
// si le registre grossit plus tard. Ne lève jamais d'exception : renvoie
// la liste des problèmes trouvés, vide si tout est cohérent.
export function validateRegistry() {
  const issues = [];

  for (const collision of ALIAS_COLLISIONS) {
    issues.push(`Alias "${collision.key}" revendiqué par plusieurs disciplines : ${collision.claimedBy.join(", ")}`);
  }

  for (const [id, disc] of Object.entries(DISCIPLINES)) {
    for (const field of REQUIRED_FIELDS) {
      if (disc[field] === undefined) issues.push(`${id} : champ obligatoire manquant "${field}"`);
    }
    if (disc.subEvents) {
      for (const sub of disc.subEvents) {
        if (!DISCIPLINES[sub]) issues.push(`${id} : sous-épreuve "${sub}" ne correspond à aucune discipline du registre`);
      }
    }
  }

  return issues;
}
