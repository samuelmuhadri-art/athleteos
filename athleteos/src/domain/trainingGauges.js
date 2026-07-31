// Cinq jauges circulaires qui résument "Ma progression > Charge
// d'entraînement" pour l'athlète. Chaque jauge affiche un mot de statut
// simple (jamais un chiffre brut en face avant) ; le chiffre et la formule
// restent disponibles dans le détail (voir FormeDetailPanel).
//
// Important : contrairement à l'ancienne version retirée du produit
// (src/athlete/shared.js, tableaux `legacyThresholdsDoNotUse`), aucune jauge
// ici n'applique une échelle fixe 0-100 à une valeur de charge absolue (les
// unités de charge sont propres à chaque athlète, sans borne universelle).
// Chaque jauge compare l'athlète à SA PROPRE référence récente (vs son
// habitude, vs sa semaine, vs son historique EWMA) — jamais à un seuil
// universel.
import { getAthleteLoadStory } from "./monitoringMetrics.js";
import { getAthleteAxisProfile, LOAD_AXES } from "../utils/loadAxes.js";

export const TRAINING_GAUGE_KEYS = new Set(["weeklyLoad", "form", "fitness", "readiness", "fatigue"]);

const STATUS_WORDS = ["Faible", "Modéré", "Bon", "Élevé", "Très élevé"];

// Bandes partagées : mêmes seuils que getAthleteLoadStory (±10 %, ±25 %) pour
// rester cohérent avec ce qui existe déjà, plutôt que d'inventer de nouveaux
// chiffres. "polarity" décide seulement la couleur, jamais les seuils :
//  - "center-good"  : le milieu ("Bon") est l'idéal, les deux extrêmes alertent.
//  - "high-good"    : plus c'est haut, mieux c'est (ex. condition physique).
//  - "high-caution" : plus c'est haut, plus ça mérite attention (ex. fatigue).
function bandFromPercent(percent, polarity) {
  if (percent == null || !Number.isFinite(percent)) return null;
  const clamped = Math.max(-100, Math.min(100, percent));
  const statusWord = clamped <= -25 ? "Faible"
    : clamped <= -10 ? "Modéré"
      : clamped < 10 ? "Bon"
        : clamped < 25 ? "Élevé"
          : "Très élevé";

  let color;
  if (polarity === "center-good") {
    color = statusWord === "Bon" ? "var(--tone-success)"
      : (statusWord === "Modéré" || statusWord === "Élevé") ? "var(--tone-warning)"
        : "var(--tone-danger)";
  } else if (polarity === "high-good") {
    color = (statusWord === "Bon" || statusWord === "Élevé" || statusWord === "Très élevé") ? "var(--tone-success)"
      : statusWord === "Modéré" ? "var(--tone-info)"
        : "var(--tone-warning)";
  } else {
    color = statusWord === "Très élevé" ? "var(--tone-danger)"
      : statusWord === "Élevé" ? "var(--tone-warning)"
        : (statusWord === "Bon" || statusWord === "Modéré") ? "var(--tone-success)"
          : "var(--tone-info)";
  }
  const fillPercent = Math.max(4, Math.min(100, Math.round(clamped + 50)));
  return { statusWord, color, fillPercent };
}

function formatSigned(value) {
  return `${value > 0 ? "+" : ""}${value}`;
}

// Compare l'EWMA longue (28 j) d'aujourd'hui à sa valeur il y a ~28 jours,
// en s'appuyant sur les dates réelles de ewmaHistory (jamais sur un simple
// décalage d'index, qui serait faussé par des trous de données).
function chronicTrendPercent(ewmaHistory) {
  const known = (ewmaHistory ?? []).filter((point) => point.chronic != null);
  if (!known.length) return null;
  const latest = known.at(-1);
  const target = new Date(latest.date);
  target.setDate(target.getDate() - 28);
  const past = [...known].reverse().find((point) => new Date(point.date) <= target);
  if (!past || !past.chronic) return null;
  return Math.round(((latest.chronic - past.chronic) / past.chronic) * 100);
}

function dominantAxisOf(athleteId, sessions, currentWeek) {
  const profile = getAthleteAxisProfile(athleteId, sessions, currentWeek);
  if (!profile) return null;
  const [id] = Object.entries(profile).sort((a, b) => b[1].currentLoad - a[1].currentLoad)[0] ?? [];
  return id ? { id, ...LOAD_AXES[id] } : null;
}

function weeklyLoadReading(metrics, sessions, athleteId) {
  const percent = metrics.variationPercent;
  const band = bandFromPercent(percent, "center-good");
  const story = getAthleteLoadStory(metrics, sessions, athleteId);
  return {
    key: "weeklyLoad", label: "Charge de la semaine", shortLabel: "Charge semaine",
    athleteMeaning: "Ce que tu as réellement effectué cette semaine, comparé à ton rythme habituel",
    kind: "Comparaison descriptive", evidence: "Calcul transparent",
    color: band?.color ?? "var(--c-text-3)", statusWord: band?.statusWord ?? null, fillPercent: band?.fillPercent ?? 8,
    displayValue: band?.statusWord ?? "—", unit: "",
    available: band != null,
    interpretation: band ? story.summary : "Il manque encore quelques jours renseignés pour comparer cette semaine à tes habitudes.",
    meaning: `Une charge très basse peut signaler un manque d'entraînement récent ; une charge très élevée peut signaler un risque de surcharge. Le milieu (« Bon ») correspond à ton rythme habituel, pas à un chiffre universel.${band ? ` ${story.cause}` : ""}`,
    formula: `Moyenne quotidienne des 7 derniers jours comparée à celle des 21 jours précédents${percent != null ? ` : ${formatSigned(percent)} %` : ""}. Charge en points d'effort (durée réelle × RPE) : ${metrics.load7 ?? "—"} cette semaine, ${metrics.load28 ?? "—"} sur les 4 dernières semaines.`,
    limits: "Le pourcentage compare l'athlète à sa propre habitude ; ce n'est ni une zone optimale ni un seuil automatique de danger.",
    missingReason: band ? null : "La comparaison demande 28 jours connus et une moyenne habituelle supérieure à zéro.",
    sources: ["Foster et al. (2001) · session-RPE", "Convention descriptive AthleteOS · fenêtres 7 et 21 jours"],
  };
}

function formReading(dailyState) {
  const score = dailyState?.score;
  const statusWord = score == null ? null
    : score < 35 ? "Faible" : score < 55 ? "Modéré" : score < 75 ? "Bon" : score < 90 ? "Élevé" : "Très élevé";
  return {
    key: "form", label: "Forme du jour", shortLabel: "Forme",
    athleteMeaning: "L'équilibre entre ton ressenti du jour et ta charge récente",
    kind: "Questionnaire interne + charge", evidence: "Convention AthleteOS",
    color: dailyState?.color ?? "var(--c-text-3)", statusWord, fillPercent: score ?? 8,
    displayValue: statusWord ?? "—", unit: "",
    available: score != null,
    interpretation: dailyState?.plainSummary ?? dailyState?.summary ?? "Réponds au questionnaire du jour pour voir ta forme.",
    meaning: `${dailyState?.loadContext ?? "Combine ton ressenti déclaré du jour et la tendance de ta charge récente."} Une forme élevée est un signal positif ; une forme basse mérite d'en parler avec ton coach, pas une alerte automatique.`,
    formula: `Moyenne des 5 réponses du questionnaire AthleteOS (sommeil, énergie, courbatures, humeur, stress), normalisée sur 0-100${score != null ? ` : ${score}/100` : ""}.`,
    limits: "Ce score subjectif n'est ni un diagnostic, ni une mesure validée de récupération physiologique.",
    missingReason: score != null ? null : "Le questionnaire AthleteOS du jour n'a pas encore été complété.",
    sources: ["AthleteOS Wellness Questionnaire v1 · instrument interne à valider"],
  };
}

function fitnessReading(metrics) {
  const percent = chronicTrendPercent(metrics.ewmaHistory);
  const band = bandFromPercent(percent, "high-good");
  const trendSentence = percent == null ? "Il manque encore assez d'historique continu pour voir une tendance sur un mois."
    : percent >= 10 ? "Ta charge habituelle augmente régulièrement depuis un mois — ta base de travail s'élargit."
      : percent <= -10 ? "Ta charge habituelle diminue depuis un mois — ce n'est pas forcément un problème (fin de bloc, récupération programmée...), mais vaut une discussion avec ton coach si ce n'est pas prévu."
        : "Ta charge habituelle est stable depuis un mois.";
  return {
    key: "fitness", label: "Condition physique", shortLabel: "Condition physique",
    athleteMeaning: "L'évolution de ta charge habituelle sur le dernier mois",
    kind: "Lissage statistique", evidence: "Méthode statistique",
    color: band?.color ?? "var(--c-text-3)", statusWord: band?.statusWord ?? null, fillPercent: band?.fillPercent ?? 8,
    displayValue: band?.statusWord ?? "—", unit: "",
    available: band != null,
    interpretation: trendSentence,
    meaning: "Reflète la construction ou la baisse progressive de ta charge de travail habituelle. Une progression régulière est en général positive ; une baisse marquée n'est pas automatiquement négative (elle peut être planifiée).",
    formula: `EWMA quotidienne (λ = 2/29) comparée à sa valeur d'il y a 28 jours${percent != null ? ` : ${formatSigned(percent)} %` : ""}. Valeur actuelle : ${metrics.chronic ?? "—"} points d'effort lissés.`,
    limits: "Cette moyenne lissée ne représente pas la forme, la fitness ou l'adaptation physiologique au sens physiologique du terme — c'est une tendance descriptive de charge.",
    missingReason: band ? null : "Il faut environ 2 mois d'historique quotidien continu pour comparer deux périodes.",
    sources: ["Banister et al. (1975) · modèle fitness-fatigue", "Williams et al. (2017) · EWMA appliquée à la charge sportive"],
  };
}

function readinessReading(metrics) {
  const recoveryStatus = metrics.recovery?.status;
  const wellness = metrics.wellnessScore;
  let statusWord = null;
  if (recoveryStatus === "spacing_active") statusWord = (wellness == null || wellness < 55) ? "Faible" : "Modéré";
  else if (recoveryStatus === "spacing_transition") statusWord = "Bon";
  else if (recoveryStatus === "window_elapsed") statusWord = (wellness != null && wellness >= 75) ? "Très élevé" : "Élevé";
  const fillPercent = statusWord ? { Faible: 20, Modéré: 40, Bon: 60, Élevé: 80, "Très élevé": 100 }[statusWord] : 8;
  const band = statusWord ? bandFromPercent(({ Faible: -40, Modéré: -15, Bon: 0, Élevé: 15, "Très élevé": 40 })[statusWord], "high-good") : null;
  const sentence = statusWord == null ? "Pas encore assez de séances récentes pour estimer ta préparation."
    : statusWord === "Faible" ? "Tu es encore dans la fenêtre d'espacement programmée après ta dernière séance exigeante — une récupération supplémentaire peut être utile avant une séance intense."
      : statusWord === "Modéré" ? "Tu es encore dans la fenêtre d'espacement programmée, mais ton ressenti du jour est plutôt bon."
        : statusWord === "Bon" ? "La fenêtre d'espacement programmée touche à sa fin."
          : "La fenêtre d'espacement programmée est terminée" + (wellness != null ? " et ton ressenti du jour est bon." : ".");
  return {
    key: "readiness", label: "Préparation", shortLabel: "Préparation",
    athleteMeaning: "Une estimation de ta capacité à enchaîner une séance exigeante aujourd'hui",
    kind: "Estimation combinée", evidence: "Règle de programmation + questionnaire",
    color: band?.color ?? "var(--c-text-3)", statusWord, fillPercent,
    displayValue: statusWord ?? "—", unit: "",
    available: statusWord != null,
    interpretation: sentence,
    meaning: "Combine la fenêtre d'espacement configurée par ton club après ta dernière séance exigeante et ton ressenti déclaré du jour, quand il est disponible.",
    formula: `Fenêtre configurable calculée depuis l'heure réelle de fin de la dernière séance validée${metrics.recovery?.rangeHoursMin != null ? ` (encore ${metrics.recovery.rangeHoursMin}–${metrics.recovery.rangeHoursMax} h)` : ""}, croisée avec le score de bien-être du jour${wellness != null ? ` (${wellness}/100)` : " (non renseigné)"}.`,
    limits: "Cette estimation n'est pas une mesure physiologique de récupération et ne remplace jamais l'avis du coach ni le ressenti réel de l'athlète.",
    missingReason: statusWord != null ? null : "Aucune séance récente avec date, heure et statut validé n'est disponible.",
    sources: ["Kellmann et al. (2018) · Recovery and Stress in Sport", "Hasegawa et al. (2024) · Recovery monitoring — IJSPP"],
  };
}

function fatigueReading(metrics, sessions, athleteId, currentWeek) {
  const percent = metrics.acwr != null ? Math.round((metrics.acwr - 1) * 100) : null;
  const band = bandFromPercent(percent, "high-caution");
  const axis = dominantAxisOf(athleteId, sessions, currentWeek);
  const axisNote = axis ? ` Tes séances ont surtout sollicité ${axis.nounPhrase} cette semaine.` : "";
  const sentence = percent == null ? "Pas encore assez d'historique continu (environ un mois) pour estimer ta sollicitation récente."
    : band.statusWord === "Très élevé" ? `Ta charge récente est nettement plus élevée que ta charge habituelle.${axisNote} Une récupération supplémentaire peut être utile.`
      : band.statusWord === "Élevé" ? `Ta charge récente est un peu plus élevée que ta charge habituelle.${axisNote}`
        : band.statusWord === "Faible" ? `Ta charge récente est nettement plus basse que ta charge habituelle — signe possible d'une récupération ou d'un volume d'entraînement réduit.${axisNote}`
          : `Ta charge récente est proche de ta charge habituelle.${axisNote}`;
  return {
    key: "fatigue", label: "Sollicitation récente", shortLabel: "Fatigue",
    athleteMeaning: "Ta charge récente comparée à ta charge habituelle des dernières semaines",
    kind: "Ratio descriptif", evidence: "Usage débattu dans la littérature",
    color: band?.color ?? "var(--c-text-3)", statusWord: band?.statusWord ?? null, fillPercent: band?.fillPercent ?? 8,
    displayValue: band?.statusWord ?? "—", unit: "",
    available: band != null,
    interpretation: sentence,
    meaning: "Compare ta charge très récente (EWMA 7 jours) à ta charge habituelle (EWMA 28 jours). Une valeur élevée ne mesure pas directement une fatigue physiologique ni un risque de blessure individuel.",
    formula: `Ratio EWMA courte ÷ EWMA longue, calculé uniquement après 28 jours quotidiens consécutifs connus${metrics.acwr != null ? ` : ${metrics.acwr.toFixed(2)} (${formatSigned(percent)} % vs ta charge habituelle)` : ""}.`,
    limits: "Ce ratio (proche de l'ACWR) fait l'objet d'un débat scientifique actif sur sa validité pour estimer un risque de blessure individuel ; il est présenté ici uniquement comme repère descriptif, jamais comme seuil de danger.",
    missingReason: band ? null : "Le ratio reste masqué tant que 28 jours consécutifs ne sont pas connus ou que l'EWMA longue vaut zéro.",
    sources: ["Impellizzeri et al. (2020) · limites conceptuelles de l'ACWR", "Gabbett (2016) · training-injury prevention paradox"],
  };
}

export function getTrainingGaugeReading(key, { metrics = {}, dailyState = null, sessions = [], athleteId = null, currentWeek = null } = {}) {
  if (key === "weeklyLoad") return weeklyLoadReading(metrics, sessions, athleteId);
  if (key === "form") return formReading(dailyState);
  if (key === "fitness") return fitnessReading(metrics);
  if (key === "readiness") return readinessReading(metrics);
  if (key === "fatigue") return fatigueReading(metrics, sessions, athleteId, currentWeek);
  return null;
}

export { STATUS_WORDS };
