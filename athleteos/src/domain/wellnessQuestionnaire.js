export const WELLNESS_QUESTION_CATALOG = Object.freeze([
  { key:"sleep", label:"Qualité du sommeil", shortLabel:"Sommeil", icon:"moon", color:"#7C3AED", inverted:false, descriptions:["Très mauvaise","Mauvaise","Correcte","Bonne","Excellente"] },
  { key:"energy", label:"Niveau d’énergie", shortLabel:"Énergie", icon:"battery", color:"#0284C7", inverted:false, descriptions:["Épuisé","Fatigué","Correct","Énergique","Très énergique"] },
  { key:"soreness", label:"Courbatures", shortLabel:"Courbatures", icon:"heart", color:"var(--tone-danger)", inverted:true, descriptions:["Aucune","Légères","Modérées","Importantes","Très importantes"] },
  { key:"mood", label:"Humeur", shortLabel:"Humeur", icon:"smile", color:"#EF9F27", inverted:false, descriptions:["Très mauvaise","Mauvaise","Neutre","Bonne","Excellente"] },
  { key:"stress", label:"Niveau de stress", shortLabel:"Stress", icon:"activity", color:"var(--tone-danger)", inverted:true, descriptions:["Aucun","Faible","Modéré","Élevé","Très élevé"] },
  { key:"motivation", label:"Motivation à s’entraîner", shortLabel:"Motivation", icon:"target", color:"#1D9E75", inverted:false, descriptions:["Très faible","Faible","Moyenne","Élevée","Très élevée"] },
  { key:"fatigue", label:"Fatigue générale", shortLabel:"Fatigue", icon:"battery-low", color:"#D97706", inverted:true, descriptions:["Aucune","Faible","Modérée","Élevée","Très élevée"] },
  { key:"pain", label:"Gêne ou douleur ressentie", shortLabel:"Gêne", icon:"heart", color:"#E05252", inverted:true, descriptions:["Aucune","Légère","Modérée","Importante","Très importante"] },
  { key:"readiness", label:"Disponibilité pour la séance", shortLabel:"Disponibilité", icon:"gauge", color:"#0EA5E9", inverted:false, descriptions:["Très faible","Faible","Moyenne","Bonne","Très bonne"] },
  { key:"concentration", label:"Capacité de concentration", shortLabel:"Concentration", icon:"brain", color:"#8B5CF6", inverted:false, descriptions:["Très faible","Faible","Moyenne","Bonne","Très bonne"] },
  { key:"hydration", label:"Sensation d’hydratation", shortLabel:"Hydratation", icon:"droplets", color:"#0891B2", inverted:false, descriptions:["Très insuffisante","Insuffisante","Moyenne","Bonne","Très bonne"] },
  { key:"mental_load", label:"Charge mentale ressentie", shortLabel:"Charge mentale", icon:"brain", color:"#DB2777", inverted:true, descriptions:["Très faible","Faible","Modérée","Élevée","Très élevée"] },
]);

export const LEGACY_WELLNESS_KEYS = Object.freeze(["sleep", "energy", "soreness", "mood", "stress"]);
export const DEFAULT_WELLNESS_QUESTIONNAIRE = Object.freeze({
  versionId:null,
  versionNumber:1,
  questions:LEGACY_WELLNESS_KEYS.map(key => ({ key, required:true })),
  activeDays:[1,2,3,4,5,6,7],
  responseVisibility:"staff",
  isDefault:true,
});

const CATALOG_BY_KEY = new Map(WELLNESS_QUESTION_CATALOG.map(question => [question.key, question]));

export function normalizeWellnessQuestionnaire(value) {
  const seen = new Set();
  const questions = (value?.questions ?? [])
    .filter(item => CATALOG_BY_KEY.has(item?.key) && !seen.has(item.key) && seen.add(item.key))
    .map(item => ({ key:item.key, required:item.required !== false }));
  const activeDays = [...new Set(value?.activeDays ?? [])].filter(day => Number.isInteger(day) && day >= 1 && day <= 7).sort((a, b) => a - b);
  return {
    ...DEFAULT_WELLNESS_QUESTIONNAIRE,
    ...value,
    questions:questions.length ? questions : DEFAULT_WELLNESS_QUESTIONNAIRE.questions.map(item => ({ ...item })),
    activeDays:activeDays.length ? activeDays : [...DEFAULT_WELLNESS_QUESTIONNAIRE.activeDays],
    responseVisibility:value?.responseVisibility === "head_coach" ? "head_coach" : "staff",
  };
}

export function configuredWellnessQuestions(configuration) {
  const normalized = normalizeWellnessQuestionnaire(configuration);
  return normalized.questions.map(item => ({ ...CATALOG_BY_KEY.get(item.key), required:item.required }));
}

export function initialWellnessAnswers(configuration, wellness = null) {
  return Object.fromEntries(configuredWellnessQuestions(configuration).map(question => [
    question.key,
    wellness?.answers?.[question.key] ?? wellness?.[question.key] ?? null,
  ]));
}

export function legacyWellnessValues(answers) {
  return Object.fromEntries(LEGACY_WELLNESS_KEYS.map(key => [key, answers?.[key] ?? null]));
}

export function requiredWellnessComplete(configuration, answers) {
  return configuredWellnessQuestions(configuration).every(question => !question.required || answers?.[question.key] != null);
}

export function wellnessQuestionnaireRequestedOn(configuration, date = new Date()) {
  const isoDay = date.getDay() === 0 ? 7 : date.getDay();
  return normalizeWellnessQuestionnaire(configuration).activeDays.includes(isoDay);
}
