// ============================================================
// AthleteOS — src/athlete/shared.js
// Constantes et helpers extraits de AthleteApp.jsx
// Utilisés dans plusieurs vues — centralisés ici
// ============================================================

import { Moon, Battery, HeartPulse, Smile, Activity } from "lucide-react";
import { getISOWeek, parseLocalDate, initialsFromName } from "../utils/helpers.js";
// Tâche 9 : le registre central des disciplines vit dans domain/disciplines.js
// (identifiant, libellé, unité, higherIsBetter, décimales, alias, sous-
// épreuves des combinées). Ce fichier ne fait plus que réexporter
// getDiscType/getDiscHib pour ne rien casser côté appelants existants —
// eux ne changent pas, seule la source de vérité derrière change.
import {
  DISCIPLINE_TYPE_COLORS, getDisciplineType, getDisciplineHib,
} from "../domain/disciplines.js";

export { getISOWeek, parseLocalDate, initialsFromName };

// ─── Nav ──────────────────────────────────────────────────────────────────────
export const DAYS_SHORT = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
export const MONTHS_FR  = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
export const DAYS_FR    = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

export const CATEGORIES = [
  { id: "sprint", label: "Sprint" }, { id: "haies", label: "Haies" },
  { id: "force", label: "Musculation" }, { id: "saut", label: "Saut" },
  { id: "lancer", label: "Lancer" }, { id: "endurance", label: "Endurance" },
  { id: "technique", label: "Technique" }, { id: "mobilite", label: "Mobilité" },
  { id: "recuperation", label: "Récupération" },
];

export const SESSION_COLORS = {
  sprint:       { bg: "#DBEAFE", border: "#3B82F6", text: "#1D4ED8" },
  haies:        { bg: "#EDE9FE", border: "#7C3AED", text: "#4C1D95" },
  force:        { bg: "#DCFCE7", border: "#16A34A", text: "#14532D" },
  saut:         { bg: "#F3E8FF", border: "#A855F7", text: "#6B21A8" },
  lancer:       { bg: "#FFEDD5", border: "#F97316", text: "#9A3412" },
  endurance:    { bg: "#E0F2FE", border: "#0284C7", text: "#0C4A6E" },
  technique:    { bg: "#F1F5F9", border: "#64748B", text: "#1E293B" },
  mobilite:     { bg: "#FEF9C3", border: "#CA8A04", text: "#713F12" },
  recuperation: { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569" },
};

// Réexport (compat) : la vraie liste vit dans domain/disciplines.js.
export const DISC_TYPE_COLORS = DISCIPLINE_TYPE_COLORS;

export const WELLNESS_QUESTIONS = [
  { key: "sleep",    label: "Qualité du sommeil",    icon: Moon,       color: "#7C3AED", desc: ["Très mauvais","Mauvais","Correct","Bon","Excellent"],            inverted: false },
  { key: "energy",   label: "Niveau d'énergie",       icon: Battery,    color: "#0284C7", desc: ["Épuisé","Fatigué","Correct","Énergique","Très énergique"],      inverted: false },
  { key: "soreness", label: "Courbatures / douleurs", icon: HeartPulse, color: "#E24B4A", desc: ["Aucune","Légères","Modérées","Importantes","Très importantes"], inverted: true  },
  { key: "mood",     label: "Humeur",                 icon: Smile,      color: "#EF9F27", desc: ["Très mauvaise","Mauvaise","Neutre","Bonne","Excellente"],        inverted: false },
  { key: "stress",   label: "Niveau de stress",       icon: Activity,   color: "#E24B4A", desc: ["Aucun","Faible","Modéré","Élevé","Très élevé"],                 inverted: true  },
];

// Niveau de preuve affiché à côté de chaque métrique — la distinction que
// chargeCalculations.js documente déjà en commentaire ("ces pondérations
// sont des conventions de coaching, pas des valeurs publiées") mais qui
// restait invisible pour l'utilisateur final. Rendue explicite ici pour
// que l'appli ne se présente jamais comme plus "scientifique" qu'elle ne
// l'est réellement.
export const EVIDENCE_LEVELS = {
  validated:   { label: "Validé scientifiquement", chip: "chip-success" },
  convention:  { label: "Convention de coaching",  chip: "chip-warning" },
  statistical: { label: "Calcul statistique",       chip: "chip-info"    },
};

// Taxonomie (tâche 15) : à quel type d'information appartient chaque
// métrique affichée dans l'app — pour ne jamais laisser un score dériver
// vers une lecture "diagnostic". Aucun élément de METRIC_SCIENCE n'est de
// catégorie "alerte médicale" : l'app ne pose aucun diagnostic, seul un
// professionnel de santé le peut.
//   - measured      : donnée brute saisie par l'athlète (RPE, wellness)
//   - estimation     : dérivé calculé à partir de mesures (charge, ACWR)
//   - signal         : pattern combinant plusieurs estimations, à
//                       contextualiser par le coach — jamais une
//                       probabilité ni une prédiction individuelle
//   - coach_decision : la lecture et la décision finale reviennent
//                       toujours au coach, jamais à un seuil automatique
export const METRIC_TAXONOMY = {
  wellness:     "measured",
  ewmaLong:     "estimation",
  ewmaShort:    "estimation",
  spacing:      "coach_decision",
  dataQuality:  "measured",
  acwrExperimental: "estimation",
};

export const METRIC_SCIENCE = {
  wellness: {
    label: "Bien-être déclaré", icon: "⚡", evidenceLevel: "convention",
    color: (v) => v >= 75 ? "#1D9E75" : v >= 50 ? "#EF9F27" : "#E24B4A",
    unit: "/100", legacyDisplayHint: "aucune zone optimale",
    formula: "AthleteOS Wellness Questionnaire v1 : cinq réponses 1–5 normalisées sur 0–100.",
    what: "Ce score résume le ressenti déclaré du jour. Cet instrument interne n'est pas le Hooper Index et ses propriétés psychométriques restent à valider.",
    sources: [
      { ref: "Gabbett (2016)", detail: "Training-injury prevention paradox — BJSM" },
      { ref: "Halson (2014)",  detail: "Monitoring training load — Sports Med" },
    ],
    legacyThresholdsDoNotUse: [
      { min: 75, max: 100, label: "Ressenti favorable", color: "#1D9E75", advice: "Retour déclaré favorable, à mettre en contexte avec le coach." },
      { min: 55, max: 74, label: "Ressenti intermédiaire", color: "#EF9F27", advice: "Retour déclaré intermédiaire, sans prescription automatique." },
      { min: 0, max: 54, label: "Ressenti difficile", color: "#E24B4A", advice: "Prends contact avec ton coach pour expliquer le contexte." },
    ],
  },
  ewmaLong: {
    label: "EWMA longue", icon: "📈", evidenceLevel: "statistical",
    color: (v) => v >= 75 ? "#1D9E75" : v >= 50 ? "#EF9F27" : "#E24B4A",
    unit: "u", legacyDisplayHint: "aucune zone optimale",
    formula: "EWMA quotidienne, λ = 2/(28+1), calculée uniquement sur des jours connus.",
    what: "L'EWMA longue lisse la charge interne observée. Elle ne mesure pas directement la forme ni l'adaptation physiologique.",
    sources: [
      { ref: "Banister et al. (1975)", detail: "Modèle Fitness-Fatigue — Research Quarterly" },
      { ref: "Morton et al. (1990)",   detail: "Modelling human performance — EJP" },
    ],
    legacyThresholdsDoNotUse: [
      { min: 75, max: 100, label: "Excellente", color: "#1D9E75", advice: "Condition physique au-dessus de ta normale. Idéal pour compétitions ou blocs intenses." },
      { min: 50, max: 74,  label: "Correcte",   color: "#EF9F27", advice: "En progression. Continue la régularité, évite les coupures." },
      { min: 0,  max: 49,  label: "Faible",     color: "#E24B4A", advice: "Augmente progressivement le volume. La régularité prime sur l'intensité." },
    ],
  },
  ewmaShort: {
    label: "EWMA courte", icon: "🔋", inverted: true, evidenceLevel: "statistical",
    color: (v) => v > 70 ? "#E24B4A" : v > 45 ? "#EF9F27" : "#1D9E75",
    unit: "u", legacyDisplayHint: "aucune zone optimale",
    formula: "EWMA quotidienne, λ = 2/(7+1), calculée uniquement sur des jours connus.",
    what: "L'EWMA courte lisse la charge interne récente. Elle ne mesure pas directement la fatigue physiologique.",
    sources: [
      { ref: "Banister et al. (1975)", detail: "Modèle Fitness-Fatigue — Research Quarterly" },
      { ref: "Meeusen et al. (2013)",  detail: "Overreaching/overtraining — MSSE" },
    ],
    legacyThresholdsDoNotUse: [
      { min: 0,  max: 45,  label: "Normale",  color: "#1D9E75", advice: "Pas de signe de suraccumulation. Tu peux maintenir ou augmenter la charge." },
      { min: 46, max: 70,  label: "Modérée",  color: "#EF9F27", advice: "Attention aux séances très intenses consécutives. Planifie une journée légère." },
      { min: 71, max: 100, label: "Élevée",   color: "#E24B4A", advice: "Réduction de charge recommandée." },
    ],
  },
  spacing: {
    label: "Règle d'espacement", icon: "🌙", evidenceLevel: "convention",
    color: (v) => v >= 70 ? "#1D9E75" : v >= 45 ? "#EF9F27" : "#E24B4A",
    unit: "h", legacyDisplayHint: "règle configurable",
    formula: "Fenêtre configurable du club calculée depuis l'heure réelle de fin de la dernière séance.",
    what: "Cette fenêtre aide à programmer l'espacement entre séances. Elle n'est pas une estimation physiologique et ne signifie jamais qu'un athlète est complètement récupéré.",
    sources: [
      { ref: "Hasegawa et al. (2024)", detail: "Recovery monitoring — IJSPP" },
      { ref: "Kellmann et al. (2018)", detail: "Recovery and Stress in Sport — Routledge" },
    ],
    legacyThresholdsDoNotUse: [
      { min: 70, max: 100, label: "Fenêtre terminée", color: "#1D9E75", advice: "La règle d'espacement est terminée ; cela ne prouve pas une récupération complète." },
      { min: 45, max: 69, label: "Transition", color: "#EF9F27", advice: "La fenêtre configurée arrive à son terme." },
      { min: 0, max: 44, label: "Fenêtre active", color: "#E24B4A", advice: "La règle d'espacement configurée est encore active." },
    ],
  },
  dataQuality: {
    // Ancienne clé conservée uniquement dans cet objet de compatibilité.
    // variables associées statistiquement à la blessure dans la littérature
    // (ACWR, monotonie, fatigue), mais ce n'est ni une probabilité de
    // blessure validée, ni un diagnostic — la relation charge/blessure est
    // multifactorielle et partiellement débattue (Gabbett lui-même souligne
    // que d'autres facteurs comptent : sommeil, stress, antécédents,
    // biomécanique, génétique...). Un score bas ne garantit rien non plus.
    label: "Qualité des données", icon: "⚠️", inverted: true, evidenceLevel: "convention",
    color: (v) => v > 60 ? "#E24B4A" : v > 30 ? "#EF9F27" : "#1D9E75",
    unit: "/28", legacyDisplayHint: "complétude uniquement",
    formula: "Complétude des durées réelles, RPE et jours quotidiens connus.",
    what: "Indique si les calculs descriptifs reposent sur assez de données quotidiennes. Ce n'est ni un risque de blessure, ni un diagnostic.",
    sources: [
      { ref: "Gabbett (2016)",      detail: "Training-injury prevention paradox — BJSM" },
      { ref: "Hulin et al. (2016)", detail: "Spikes in acute workload — BJSM" },
      { ref: "Foster (1998)",       detail: "Monotony of training — J Strength Cond" },
    ],
    legacyThresholdsDoNotUse: [
      { min: 0, max: 30, label: "Incomplète", color: "#E24B4A", advice: "Plusieurs données quotidiennes manquent." },
      { min: 31, max: 60, label: "Partielle", color: "#EF9F27", advice: "Certaines fenêtres restent indisponibles." },
      { min: 61, max: 100, label: "Bonne", color: "#1D9E75", advice: "Les données nécessaires sont majoritairement présentes." },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function dimColor(metric, val) {
  switch (metric) {
    case "wellness": return "#A78BFA";
    case "ewmaLong": return "#EC4899";
    case "ewmaShort": return "#A855F7";
    case "spacing": return "#38BDF8";
    case "dataQuality": return "#94A3B8";
    case "acwrExperimental": return "#8B5CF6";
    case "streak": return val >= 3 ? "#378ADD" : "rgba(55,138,221,0.45)";
    default: return "#94A3B8";
  }
}

export function acwrColor() {
  return "#8B5CF6";
}

export function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

// Inverse de parseLocalDate : Date -> "YYYY-MM-DD" en heure LOCALE.
// Ne jamais utiliser .toISOString() sur un Date local ici : ça convertit
// en UTC et décale le jour d'un cran dans les fuseaux positifs (ex.
// Belgique) — une séance créée pour le 25 s'affichait le 26 dans le
// calendrier/la liste alors que la notif (qui lit la string brute en
// base) montrait bien le 25.
export function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateToISOWeek(s) { return getISOWeek(parseLocalDate(s)); }
export function dateToDayName(s) { return DAYS_FR[(parseLocalDate(s).getDay()+6)%7]; }
export function colorsFor(cat) { return SESSION_COLORS[cat] ?? SESSION_COLORS.technique; }

// Parse UNIQUEMENT la valeur numérique d'une performance ("11.20" -> 11.2,
// "4:32" -> 272, "7.60m" -> 7.6). Ne devine JAMAIS le sens (plus petit ou
// plus grand est meilleur) depuis le FORMAT de la chaîne — un lancer de
// poids saisi "14.20" (sans "m") ressemble textuellement à un chrono, et
// l'ancienne version de cette fonction s'y trompait. Le sens vient
// TOUJOURS de la discipline via getDiscHib(), jamais d'ici (tâche 11).
export function parsePerf(str) {
  if (!str) return { value: null };
  const s = str.toString().trim();
  if (/^\d+:\d+/.test(s)) { const [m, sec] = s.split(":").map(Number); return { value: m * 60 + sec }; }
  const num = parseFloat(s);
  return { value: isNaN(num) ? null : num };
}

// getDiscType/getDiscHib délèguent au registre central (domain/disciplines.js,
// tâche 9) — signatures inchangées pour ne rien casser côté appelants,
// mais résolvent maintenant aussi les alias historiques ("100 m" -> "100m")
// au lieu d'un lookup exact sur un seul nom.
export function getDiscType(discName) {
  return getDisciplineType(discName);
}

export function getDiscHib(discName) {
  return getDisciplineHib(discName);
}

// ─── Moteur central de comparaison de performances (tâche 11) ────────────────
// Point unique de vérité pour "est-ce mieux", "quelle est la meilleure
// valeur" et "quel pourcentage d'une référence est atteint" — à utiliser
// PARTOUT à la place de comparaisons/ratios écrits à la main (Math.max,
// v > best, current/target...), qui supposent implicitement "plus grand =
// meilleur" et se trompent sur toutes les disciplines chronométrées.

// `a` est-il meilleur ou égal à `b` (nombres déjà parsés, pas des chaînes) ?
export function isBetterOrEqual(a, b, discipline) {
  if (a == null) return false;
  if (b == null) return true;
  const higherIsBetter = getDiscHib(discipline);
  if (higherIsBetter == null) return false;
  return higherIsBetter ? a >= b : a <= b;
}

// Comparateur numérique pour .sort() — trie du meilleur au moins bon.
// Ex: values.sort((a, b) => compareValues(a, b, "100m"))
export function compareValues(a, b, discipline) {
  const higherIsBetter = getDiscHib(discipline);
  if (higherIsBetter == null) return 0;
  return higherIsBetter ? b - a : a - b;
}

// % d'accomplissement d'une valeur "current" par rapport à une "reference"
// (typiquement le PR pour un résultat de compétition, ou le PR pour un
// objectif visé), dans le bon sens selon la discipline, plafonné à 100%.
// Sert à la fois pour "% du PR réalisé en compétition" (current=résultat,
// reference=PR) et pour "progression vers un objectif" (current=PR,
// reference=objectif) — même formule, mêmes garanties, un seul endroit à
// corriger si un jour elle doit changer.
export function pctOfReference(currentValue, referenceValue, discipline) {
  if (currentValue == null || referenceValue == null || referenceValue === 0) return null;
  const hib = getDiscHib(discipline);
  if (hib == null) return null;
  const ratio = hib ? currentValue / referenceValue : referenceValue / currentValue;
  return Math.min(100, Math.round(ratio * 1000) / 10);
}
