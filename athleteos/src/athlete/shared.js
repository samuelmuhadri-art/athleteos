// ============================================================
// AthleteOS — src/athlete/shared.js
// Constantes et helpers extraits de AthleteApp.jsx
// Utilisés dans plusieurs vues — centralisés ici
// ============================================================

import { Moon, Battery, HeartPulse, Smile, Activity } from "lucide-react";

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

export const DISC_PRESETS = [
  { name: "100m",        type: "sprint",    unit: "s",     hib: false },
  { name: "200m",        type: "sprint",    unit: "s",     hib: false },
  { name: "400m",        type: "sprint",    unit: "s",     hib: false },
  { name: "800m",        type: "endurance", unit: "min:s", hib: false },
  { name: "1500m",       type: "endurance", unit: "min:s", hib: false },
  { name: "60m haies",   type: "sprint",    unit: "s",     hib: false },
  { name: "100m haies",  type: "sprint",    unit: "s",     hib: false },
  { name: "110m haies",  type: "sprint",    unit: "s",     hib: false },
  { name: "400m haies",  type: "sprint",    unit: "s",     hib: false },
  { name: "Longueur",    type: "saut",      unit: "m",     hib: true  },
  { name: "Triple saut", type: "saut",      unit: "m",     hib: true  },
  { name: "Hauteur",     type: "saut",      unit: "m",     hib: true  },
  { name: "Perche",      type: "saut",      unit: "m",     hib: true  },
  { name: "Poids",       type: "lancer",    unit: "m",     hib: true  },
  { name: "Disque",      type: "lancer",    unit: "m",     hib: true  },
  { name: "Javelot",     type: "lancer",    unit: "m",     hib: true  },
  { name: "Marteau",     type: "lancer",    unit: "m",     hib: true  },
  { name: "Décathlon",   type: "combine",   unit: "pts",   hib: true  },
  { name: "Heptathlon",  type: "combine",   unit: "pts",   hib: true  },
];

export const DISC_TYPE_COLORS = {
  sprint:    { bg: "#DBEAFE", border: "#3B82F6", text: "#1D4ED8", dot: "#3B82F6" },
  endurance: { bg: "#E0F2FE", border: "#0284C7", text: "#0C4A6E", dot: "#0284C7" },
  saut:      { bg: "#F3E8FF", border: "#A855F7", text: "#6B21A8", dot: "#A855F7" },
  lancer:    { bg: "#FFEDD5", border: "#F97316", text: "#9A3412", dot: "#F97316" },
  combine:   { bg: "#FEF9C3", border: "#CA8A04", text: "#713F12", dot: "#CA8A04" },
};

export const WELLNESS_QUESTIONS = [
  { key: "sleep",    label: "Qualité du sommeil",    icon: Moon,       color: "#7C3AED", desc: ["Très mauvais","Mauvais","Correct","Bon","Excellent"],            inverted: false },
  { key: "energy",   label: "Niveau d'énergie",       icon: Battery,    color: "#0284C7", desc: ["Épuisé","Fatigué","Correct","Énergique","Très énergique"],      inverted: false },
  { key: "soreness", label: "Courbatures / douleurs", icon: HeartPulse, color: "#E24B4A", desc: ["Aucune","Légères","Modérées","Importantes","Très importantes"], inverted: true  },
  { key: "mood",     label: "Humeur",                 icon: Smile,      color: "#EF9F27", desc: ["Très mauvaise","Mauvaise","Neutre","Bonne","Excellente"],        inverted: false },
  { key: "stress",   label: "Niveau de stress",       icon: Activity,   color: "#E24B4A", desc: ["Aucun","Faible","Modéré","Élevé","Très élevé"],                 inverted: true  },
];

export const METRIC_SCIENCE = {
  readiness: {
    label: "Readiness", icon: "⚡",
    color: (v) => v >= 75 ? "#1D9E75" : v >= 50 ? "#EF9F27" : "#E24B4A",
    unit: "/100", optimal: "≥ 75",
    formula: "Moyenne pondérée : Forme (40%) + Récupération (35%) + Wellness (25%)",
    what: "Le Readiness mesure ta capacité globale à performer aujourd'hui. Un score élevé signifie que ton corps est physiologiquement prêt à absorber une charge d'entraînement intense.",
    sources: [
      { ref: "Gabbett (2016)", detail: "Training-injury prevention paradox — BJSM" },
      { ref: "Halson (2014)",  detail: "Monitoring training load — Sports Med" },
    ],
    thresholds: [
      { min: 75, max: 100, label: "Optimal",    color: "#1D9E75", advice: "Séance intense possible. Profites-en pour travailler vitesse ou force maximale." },
      { min: 55, max: 74,  label: "Acceptable", color: "#EF9F27", advice: "Séance modérée recommandée. Évite les blocs à haute intensité répétée." },
      { min: 0,  max: 54,  label: "Faible",     color: "#E24B4A", advice: "Récupération active, mobilité ou repos complet. Ne force pas." },
    ],
  },
  forme: {
    label: "Forme", icon: "📈",
    color: (v) => v >= 75 ? "#1D9E75" : v >= 50 ? "#EF9F27" : "#E24B4A",
    unit: "/100", optimal: "≥ 65",
    formula: "Charge chronique (moyenne 4 semaines) normalisée sur 100.",
    what: "La Forme (fitness) représente les adaptations positives accumulées sur les 4 dernières semaines.",
    sources: [
      { ref: "Banister et al. (1975)", detail: "Modèle Fitness-Fatigue — Research Quarterly" },
      { ref: "Morton et al. (1990)",   detail: "Modelling human performance — EJP" },
    ],
    thresholds: [
      { min: 75, max: 100, label: "Excellente", color: "#1D9E75", advice: "Condition physique au-dessus de ta normale. Idéal pour compétitions ou blocs intenses." },
      { min: 50, max: 74,  label: "Correcte",   color: "#EF9F27", advice: "En progression. Continue la régularité, évite les coupures." },
      { min: 0,  max: 49,  label: "Faible",     color: "#E24B4A", advice: "Augmente progressivement le volume. La régularité prime sur l'intensité." },
    ],
  },
  fatigue: {
    label: "Fatigue", icon: "🔋", inverted: true,
    color: (v) => v > 70 ? "#E24B4A" : v > 45 ? "#EF9F27" : "#1D9E75",
    unit: "/100", optimal: "≤ 45",
    formula: "Charge aiguë (moyenne 7 derniers jours) normalisée.",
    what: "La fatigue représente l'accumulation de stress physiologique récent.",
    sources: [
      { ref: "Banister et al. (1975)", detail: "Modèle Fitness-Fatigue — Research Quarterly" },
      { ref: "Meeusen et al. (2013)",  detail: "Overreaching/overtraining — MSSE" },
    ],
    thresholds: [
      { min: 0,  max: 45,  label: "Normale",  color: "#1D9E75", advice: "Pas de signe de suraccumulation. Tu peux maintenir ou augmenter la charge." },
      { min: 46, max: 70,  label: "Modérée",  color: "#EF9F27", advice: "Attention aux séances très intenses consécutives. Planifie une journée légère." },
      { min: 71, max: 100, label: "Élevée",   color: "#E24B4A", advice: "Réduction de charge recommandée." },
    ],
  },
  recuperation: {
    label: "Récupération", icon: "🌙",
    color: (v) => v >= 70 ? "#1D9E75" : v >= 45 ? "#EF9F27" : "#E24B4A",
    unit: "/100", optimal: "≥ 70",
    formula: "Basée sur le ratio Forme/Fatigue et les données wellness. Convention coaching AthleteOS.",
    what: "La récupération estime la capacité neuromusculaire et métabolique à absorber une nouvelle séance.",
    sources: [
      { ref: "Hasegawa et al. (2024)", detail: "Recovery monitoring — IJSPP" },
      { ref: "Kellmann et al. (2018)", detail: "Recovery and Stress in Sport — Routledge" },
    ],
    thresholds: [
      { min: 70, max: 100, label: "Complète",     color: "#1D9E75", advice: "Physiologiquement disponible pour une nouvelle charge." },
      { min: 45, max: 69,  label: "Partielle",    color: "#EF9F27", advice: "Récupération en cours. Séance technique ou légère recommandée." },
      { min: 0,  max: 44,  label: "Insuffisante", color: "#E24B4A", advice: "Récupération neuromusculaire incomplète. Priorité au repos." },
    ],
  },
  risque: {
    label: "Risque blessure", icon: "⚠️", inverted: true,
    color: (v) => v > 60 ? "#E24B4A" : v > 30 ? "#EF9F27" : "#1D9E75",
    unit: "/100", optimal: "≤ 30",
    formula: "Composé de l'ACWR (60%), monotonie (20%) et fatigue (20%). Modèle Gabbett.",
    what: "Le risque de blessure détecte les patterns dangereux : surcharge aiguë, entraînements monotones, fatigue accumulée.",
    sources: [
      { ref: "Gabbett (2016)",      detail: "Training-injury prevention paradox — BJSM" },
      { ref: "Hulin et al. (2016)", detail: "Spikes in acute workload — BJSM" },
      { ref: "Foster (1998)",       detail: "Monotony of training — J Strength Cond" },
    ],
    thresholds: [
      { min: 0,  max: 30,  label: "Faible", color: "#1D9E75", advice: "Aucun signal d'alarme. Continue ton programme normalement." },
      { min: 31, max: 60,  label: "Modéré", color: "#EF9F27", advice: "ACWR ou monotonie élevés. Varie les intensités." },
      { min: 61, max: 100, label: "Élevé",  color: "#E24B4A", advice: "Réduis immédiatement la charge. Consulte ton coach." },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function initialsFromName(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function dimColor(metric, val) {
  switch (metric) {
    case "readiness": case "recuperation": case "forme":
      if (val >= 75) return "#1D9E75"; if (val >= 50) return "#EF9F27"; return "#E24B4A";
    case "fatigue":
      if (val > 70) return "#E24B4A"; if (val > 45) return "#EF9F27"; return "rgba(239,159,39,0.45)";
    case "risque":
      if (val > 60) return "#E24B4A"; if (val > 30) return "#EF9F27"; return "#1D9E75";
    case "acwr":
      if (val > 1.5) return "#E24B4A"; if (val > 1.3) return "#EF9F27"; return "#378ADD";
    case "streak": return val >= 3 ? "#378ADD" : "rgba(55,138,221,0.45)";
    case "wellness": return "#A78BFA";
    default: return "#94A3B8";
  }
}

export function acwrColor(v) {
  if (v > 1.5) return "#E24B4A"; if (v > 1.3) return "#EF9F27"; return "#378ADD";
}

export function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

export function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay()+6)%7 + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(),0,4));
  return 1 + Math.round((d-jan4)/(7*24*60*60*1000));
}

export function parseLocalDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateToISOWeek(s) { return getISOWeek(parseLocalDate(s)); }
export function dateToDayName(s) { return DAYS_FR[(parseLocalDate(s).getDay()+6)%7]; }
export function colorsFor(cat) { return SESSION_COLORS[cat] ?? SESSION_COLORS.technique; }

export function parsePerf(str) {
  if (!str) return { value: null, hib: true };
  const s = str.toString().trim();
  if (/^\d+:\d+/.test(s)) { const [m,sec]=s.split(":").map(Number); return { value: m*60+sec, hib: false }; }
  if (s.endsWith("m"))   return { value: parseFloat(s), hib: true };
  if (s.includes("pts")) return { value: parseFloat(s), hib: true };
  if (s.endsWith("s") || /^\d+\.\d+$/.test(s)) return { value: parseFloat(s), hib: false };
  return { value: parseFloat(s)||null, hib: true };
}

export function getDiscType(discName) {
  return DISC_PRESETS.find(d => d.name === discName)?.type ?? "sprint";
}

export function getDiscHib(discName) {
  return DISC_PRESETS.find(d => d.name === discName)?.hib ?? false;
}