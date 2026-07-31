import { computeWellnessScore } from "../utils/trainingLoad";

const FACTORS = Object.freeze([
  { key: "sleep", label: "Sommeil", inverted: false, positive: "Ton sommeil t'aide aujourd'hui", attention: "Ton sommeil semble moins bon aujourd'hui" },
  { key: "energy", label: "Énergie", inverted: false, positive: "Tu déclares une bonne énergie", attention: "Tu déclares peu d'énergie" },
  { key: "soreness", label: "Courbatures", inverted: true, positive: "Tu déclares peu de courbatures", attention: "Tes courbatures sont marquées" },
  { key: "mood", label: "Humeur", inverted: false, positive: "Ton humeur est positive", attention: "Ton humeur est plus basse" },
  { key: "stress", label: "Stress", inverted: true, positive: "Tu déclares peu de stress", attention: "Ton stress est marqué" },
]);

function factorReading(factor, value) {
  if (value == null) return { ...factor, value: null, oriented: null, tone: "unknown", meaning: "Non renseigné" };
  const oriented = factor.inverted ? 6 - Number(value) : Number(value);
  const tone = oriented >= 4 ? "positive" : oriented <= 2 ? "attention" : "neutral";
  const meaning = tone === "positive"
    ? factor.positive
    : tone === "attention"
      ? factor.attention
      : "Ta réponse est au milieu de l'échelle";
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
  const rawVariation = metrics.variationPercent ?? metrics.variation;
  const variation = rawVariation == null
    ? null
    : Number.isFinite(Number(rawVariation)) ? Number(rawVariation) : null;

  if (score == null) return {
    score: null, label: "Comment te sens-tu aujourd'hui ?", legacyLabel: "Ton check-in manque", color: "#8A9B90", tone: "unknown",
    summary: "Réponds aux cinq questions pour donner à ton coach une image simple de ton ressenti.",
    plainHeadline: "Ton ressenti n'est pas encore renseigné",
    plainSummary: "Cinq réponses suffisent pour voir ce qui t'aide et ce qui mérite une discussion.",
    helps: [], watch: [], coachPrompt: "Complète ton check-in avant la séance si tu le peux.",
    factors, baseline, delta, variation, known: factors.filter(item => item.value != null).length,
  };

  let descriptor = score >= 75
    ? { label: "De bonnes ressources aujourd'hui", legacyLabel: "Plutôt favorable", color: "var(--tone-success)", tone: "positive" }
    : score >= 55
      ? { label: baseline == null ? "Un état globalement équilibré" : "Un état proche de tes habitudes", legacyLabel: baseline == null ? "Ressenti plutôt équilibré" : "Dans tes habitudes", color: "var(--tone-info)", tone: "neutral" }
      : score >= 35
        ? { label: "Quelques points à adapter", legacyLabel: "À adapter aujourd'hui", color: "var(--tone-warning)", tone: "attention" }
        : { label: "Une journée à aborder avec prudence", legacyLabel: "Journée exigeante", color: "var(--tone-danger)", tone: "attention" };
  if (baseline != null && score >= 55 && score < 75 && delta >= 12) descriptor = { label: "Tu te sens mieux que d'habitude", legacyLabel: "Mieux que ton habitude", color: "var(--tone-success)", tone: "positive" };
  if (baseline != null && score >= 55 && score < 75 && delta <= -12) descriptor = { label: "Tu te sens moins bien que d'habitude", legacyLabel: "En dessous de ton habitude", color: "var(--tone-warning)", tone: "attention" };
  const attention = factors.filter(item => item.tone === "attention");
  const positive = factors.filter(item => item.tone === "positive");
  const helps = positive.map(item => item.meaning);
  const watch = attention.map(item => item.meaning);
  let summary = attention.length
    ? `${attention.slice(0, 2).map(item => item.label).join(" et ")} mérite${attention.length > 1 ? "nt" : ""} une attention particulière.`
    : "Aucun des cinq ressentis déclarés ne ressort comme un point d'attention marqué.";
  if (positive.length) summary = `${positive.slice(0, 2).map(item => item.label).join(" et ")} ${positive.length > 1 ? "sont" : "est"} plutôt favorable${positive.length > 1 ? "s" : ""}. ${summary}`;
  const loadContext = variation == null
    ? "Ta charge récente reste affichée séparément dès que suffisamment de séances sont renseignées."
    : variation > 20
      ? "Ta charge récente est plus élevée que ton rythme habituel."
      : variation < -20
        ? "Ta charge récente est plus basse que ton rythme habituel."
        : "Ta charge récente est proche de ton rythme habituel.";
  const coachPrompt = attention.length
    ? `Parle à ton coach de ${attention.slice(0, 2).map(item => item.label.toLowerCase()).join(" et ")} avant d'adapter la séance.`
    : "Si ton ressenti change pendant l'échauffement, signale-le simplement à ton coach.";

  return {
    ...descriptor, score, summary, plainHeadline: descriptor.label,
    plainSummary: summary, loadContext, helps, watch, coachPrompt,
    factors, baseline, delta, variation, known: 5,
  };
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
