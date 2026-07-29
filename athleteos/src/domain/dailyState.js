import { computeWellnessScore } from "../utils/trainingLoad";

const FACTORS = Object.freeze([
  { key: "sleep", label: "Sommeil", inverted: false },
  { key: "energy", label: "Énergie", inverted: false },
  { key: "soreness", label: "Courbatures", inverted: true },
  { key: "mood", label: "Humeur", inverted: false },
  { key: "stress", label: "Stress", inverted: true },
]);

function factorReading(factor, value) {
  if (value == null) return { ...factor, value: null, oriented: null, tone: "unknown", meaning: "Non renseigné" };
  const oriented = factor.inverted ? 6 - Number(value) : Number(value);
  const tone = oriented >= 4 ? "positive" : oriented <= 2 ? "attention" : "neutral";
  const meaning = factor.inverted
    ? (value <= 2 ? "Peu marqué" : value >= 4 ? "Marqué aujourd’hui" : "Intermédiaire")
    : (value >= 4 ? "Positif aujourd’hui" : value <= 2 ? "Bas aujourd’hui" : "Intermédiaire");
  return { ...factor, value: Number(value), oriented, tone, meaning };
}

export function buildDailyState({ wellness, history = [], metrics = {} }) {
  const score = computeWellnessScore(wellness);
  const factors = FACTORS.map(factor => factorReading(factor, wellness?.[factor.key]));
  const pastScores = history
    .filter(row => row && row.date !== wellness?.date)
    .map(computeWellnessScore)
    .filter(value => value != null);
  const baseline = pastScores.length >= 3
    ? Math.round(pastScores.reduce((sum, value) => sum + value, 0) / pastScores.length)
    : null;
  const delta = score != null && baseline != null ? score - baseline : null;
  const variation = metrics.variation == null
    ? null
    : Number.isFinite(Number(metrics.variation)) ? Number(metrics.variation) : null;

  if (score == null) return {
    score: null, label: "Ton check-in manque", color: "#8A9B90", tone: "unknown",
    summary: "Réponds aux cinq questions pour obtenir une lecture claire de ton ressenti aujourd’hui.",
    factors, baseline, delta, variation, known: factors.filter(item => item.value != null).length,
  };

  let descriptor = score >= 75
    ? { label: "Plutôt favorable", color: "#4DC9A0", tone: "positive" }
    : score >= 55
      ? { label: baseline == null ? "Ressenti plutôt équilibré" : "Dans tes habitudes", color: "#69C5F7", tone: "neutral" }
      : score >= 35
        ? { label: "À adapter aujourd’hui", color: "#F2C46D", tone: "attention" }
        : { label: "Journée exigeante", color: "#F29B9A", tone: "attention" };
  if (baseline != null && score >= 55 && score < 75 && delta >= 12) descriptor = { label: "Mieux que ton habitude", color: "#4DC9A0", tone: "positive" };
  if (baseline != null && score >= 55 && score < 75 && delta <= -12) descriptor = { label: "En dessous de ton habitude", color: "#F2C46D", tone: "attention" };
  const attention = factors.filter(item => item.tone === "attention");
  const positive = factors.filter(item => item.tone === "positive");
  let summary = positive.length
    ? `${positive.slice(0, 2).map(item => item.label.toLowerCase()).join(" et ")} ${positive.length > 1 ? "sont" : "est"} favorable${positive.length > 1 ? "s" : ""} aujourd’hui.`
    : "Ton ressenti est proche du milieu de l’échelle aujourd’hui.";
  if (attention.length) summary += ` ${attention.slice(0, 2).map(item => item.label).join(" et ")} mérite${attention.length > 1 ? "nt" : ""} ton attention.`;
  if (variation != null && variation > 25) summary += " Ta charge récente est aussi plus élevée que d’habitude.";

  return { ...descriptor, score, summary, factors, baseline, delta, variation, known: 5 };
}

export function buildGroupDailyState(athletes, wellnessRows, metricsByAthlete = new Map()) {
  const states = athletes.map(athlete => ({
    athlete,
    state: buildDailyState({ wellness: wellnessRows.find(row => row.athleteId === athlete.id), metrics: metricsByAthlete.get(athlete.id) ?? {} }),
  }));
  const completed = states.filter(item => item.state.score != null);
  return {
    states,
    completed: completed.length,
    favorable: completed.filter(item => item.state.tone === "positive").length,
    attention: completed.filter(item => item.state.tone === "attention").length,
    average: completed.length ? Math.round(completed.reduce((sum, item) => sum + item.state.score, 0) / completed.length) : null,
  };
}
