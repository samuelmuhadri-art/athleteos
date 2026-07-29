// Mesures de suivi descriptives affichées dans AthleteOS.
// Aucune de ces lignes n'est une probabilité de blessure, une mesure directe
// de fitness/fatigue physiologique ou une autorisation automatique de s'entraîner.

export const MONITORING_METRICS = {
  wellness: {
    label: "Bien-être déclaré",
    shortLabel: "Comment tu te sens",
    athleteMeaning: "Ton ressenti du jour",
    color: "#1D9E75",
    kind: "Questionnaire interne",
    evidence: "Convention AthleteOS",
    formula: "Moyenne des 5 réponses du questionnaire AthleteOS v1, normalisée de 0 à 100.",
    meaning: "Résume le sommeil, l'énergie, les courbatures, l'humeur et le stress déclarés aujourd'hui.",
    limits: "Ce score subjectif n'est ni un diagnostic, ni une mesure validée de readiness ou de récupération.",
    sources: ["AthleteOS Wellness Questionnaire v1 · instrument interne à valider"],
  },
  load7: {
    label: "Charge observée · 7 jours",
    shortLabel: "Charge de la semaine",
    athleteMeaning: "Ce que tu as réellement effectué ces 7 derniers jours",
    color: "#4B7BDB",
    kind: "Mesure de charge interne",
    evidence: "Méthode publiée",
    formula: "Somme sur 7 jours de chaque charge session-RPE : durée réelle (min) × RPE CR10.",
    meaning: "Quantifie la charge interne déclarée sur les sept derniers jours civils connus.",
    limits: "La valeur ne compare pas deux sports et ne prédit ni adaptation, ni fatigue, ni blessure.",
    sources: ["Foster et al. (2001) · session-RPE"],
  },
  load28: {
    label: "Charge observée · 28 jours",
    shortLabel: "Charge du dernier mois",
    athleteMeaning: "Ton historique des 4 dernières semaines",
    color: "#14B8A6",
    kind: "Mesure de charge interne",
    evidence: "Méthode publiée",
    formula: "Somme des charges session-RPE sur 28 jours civils continus et connus.",
    meaning: "Décrit le volume de charge interne observé pendant les quatre dernières semaines.",
    limits: "Ce total n'est pas une mesure de fitness et ne doit pas être normalisé contre un maximum historique.",
    sources: ["Foster et al. (2001) · session-RPE"],
  },
  ewmaAcute: {
    label: "EWMA courte · 7 jours",
    shortLabel: "Rythme récent",
    athleteMeaning: "Une moyenne qui donne plus de poids à tes derniers jours",
    color: "#A855F7",
    kind: "Lissage statistique",
    evidence: "Méthode statistique",
    formula: "EWMA quotidienne avec λ = 2 / (7 + 1), remise à zéro après une donnée inconnue.",
    meaning: "Donne davantage de poids aux charges quotidiennes récentes afin de décrire leur dynamique.",
    limits: "Le terme « courte » décrit la fenêtre mathématique ; cette valeur ne mesure pas directement la fatigue.",
    sources: ["Murray et al. (2017) · application EWMA aux charges sportives"],
  },
  ewmaChronic: {
    label: "EWMA longue · 28 jours",
    shortLabel: "Repère habituel",
    athleteMeaning: "Une moyenne plus stable de ton dernier mois",
    color: "#EC4899",
    kind: "Lissage statistique",
    evidence: "Méthode statistique",
    formula: "EWMA quotidienne avec λ = 2 / (28 + 1), remise à zéro après une donnée inconnue.",
    meaning: "Lisse plus lentement la charge quotidienne observée pour fournir un repère historique descriptif.",
    limits: "Cette moyenne lissée ne représente pas la forme, la fitness ou l'adaptation physiologique.",
    sources: ["Murray et al. (2017) · application EWMA aux charges sportives"],
  },
  variation: {
    label: "Variation du profil habituel",
    shortLabel: "Évolution de ta charge",
    athleteMeaning: "La différence entre cette semaine et tes 3 semaines précédentes",
    color: "#F59E0B",
    kind: "Comparaison descriptive",
    evidence: "Calcul transparent",
    formula: "Moyenne quotidienne des 7 derniers jours comparée à celle des 21 jours précédents.",
    meaning: "Montre si la charge quotidienne récente est plus haute, similaire ou plus basse que l'historique proche.",
    limits: "Aucun pourcentage n'est une zone optimale ou un seuil automatique de danger.",
    sources: ["Convention descriptive AthleteOS · fenêtres 7 et 21 jours"],
  },
  monotony: {
    label: "Monotonie · 7 jours",
    shortLabel: "Variété de la semaine",
    athleteMeaning: "À quel point tes journées ont été différentes entre elles",
    color: "#F97316",
    kind: "Mesure descriptive",
    evidence: "Méthode publiée",
    formula: "Moyenne des 7 charges quotidiennes ÷ écart-type de ces mêmes 7 jours.",
    meaning: "Décrit la variabilité des charges quotidiennes d'une semaine complète.",
    limits: "Si les sept valeurs sont identiques, l'écart-type est nul et AthleteOS affiche « indéfinie » au lieu d'inventer 0.",
    sources: ["Foster (1998) · training monotony"],
  },
  spacing: {
    label: "Règle d'espacement",
    shortLabel: "Temps entre les séances",
    athleteMeaning: "Le délai prévu par ton club entre deux contraintes similaires",
    color: "#38BDF8",
    kind: "Règle de programmation",
    evidence: "Configuration du club",
    formula: "Fenêtre configurable calculée depuis l'heure réelle de fin de la dernière séance validée.",
    meaning: "Aide le coach à espacer deux séances ciblant une contrainte similaire.",
    limits: "Ce compteur n'est pas une estimation physiologique et ne signifie jamais « complètement récupéré ».",
    sources: ["Règle de programmation AthleteOS · configurable par catégorie"],
  },
  dataQuality: {
    label: "Qualité de l'historique",
    shortLabel: "Données disponibles",
    athleteMeaning: "Les jours assez renseignés pour interpréter ta charge",
    color: "#94A3B8",
    kind: "Contrôle de complétude",
    evidence: "Contrôle technique",
    formula: "Nombre de jours quotidiens consécutifs connus ; repos confirmé = 0, absence d'information = null.",
    meaning: "Indique si les fenêtres de 7 et 28 jours reposent sur un historique suffisamment complet.",
    limits: "La complétude mesure la qualité des données, pas la qualité de l'entraînement ni l'état de l'athlète.",
    sources: ["Convention de qualité des données AthleteOS"],
  },
  acwrExperimental: {
    label: "ACWR EWMA expérimental",
    shortLabel: "Ratio de recherche",
    athleteMeaning: "Un calcul expérimental réservé à la lecture avancée",
    color: "#8B5CF6",
    kind: "Métrique de recherche",
    evidence: "Usage controversé",
    formula: "EWMA courte ÷ EWMA longue, uniquement après 28 jours quotidiens consécutifs connus.",
    meaning: "Expose le ratio à titre de recherche et de transparence méthodologique.",
    limits: "Aucune zone optimale, aucun risque individuel et aucune consigne d'entraînement ne sont déduits de ce ratio.",
    sources: ["Impellizzeri et al. (2020) · limites conceptuelles de l'ACWR"],
  },
};

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(2).replace(/\.00$/u, "");
}

export function getMonitoringReading(key, metrics = {}) {
  const definition = MONITORING_METRICS[key];
  if (!definition) return null;

  let value = null;
  let displayValue = "—";
  let unit = "";
  let interpretation = "Donnée indisponible.";
  let missingReason = "L'historique quotidien n'est pas encore assez complet.";

  if (key === "wellness") {
    value = metrics.wellnessScore;
    unit = "/100";
    if (value != null) {
      displayValue = formatNumber(value);
      interpretation = `Questionnaire complété : ${displayValue}/100. Lis surtout le détail des cinq réponses.`;
    } else missingReason = "Le questionnaire AthleteOS du jour n'a pas encore été complété.";
  } else if (key === "load7" || key === "load28") {
    value = metrics[key];
    unit = "u";
    if (value != null) {
      displayValue = formatNumber(value);
      interpretation = `${displayValue} unités de charge session-RPE observées sur ${key === "load7" ? 7 : 28} jours.`;
    } else missingReason = `La fenêtre de ${key === "load7" ? 7 : 28} jours contient au moins un jour inconnu.`;
  } else if (key === "ewmaAcute" || key === "ewmaChronic") {
    value = key === "ewmaAcute" ? metrics.acute : metrics.chronic;
    unit = "u";
    if (value != null) {
      displayValue = formatNumber(value);
      interpretation = `${displayValue} unités dans la moyenne exponentielle ${key === "ewmaAcute" ? "courte" : "longue"}.`;
    } else missingReason = "Aucune séquence quotidienne connue ne permet encore le lissage.";
  } else if (key === "variation") {
    value = metrics.variationPercent;
    unit = "%";
    if (value != null) {
      displayValue = `${value > 0 ? "+" : ""}${formatNumber(value)}`;
      const direction = value > 0 ? "plus élevée" : value < 0 ? "plus basse" : "similaire";
      interpretation = `La moyenne quotidienne récente est ${direction} que celle des 21 jours précédents (${displayValue}%).`;
    } else missingReason = "La comparaison demande 28 jours connus et une moyenne habituelle supérieure à zéro.";
  } else if (key === "monotony") {
    value = metrics.monotony;
    if (metrics.monotonyStatus === "undefined_zero_variance") {
      displayValue = "Indéfinie";
      interpretation = "Les sept charges quotidiennes sont identiques : l'écart-type est nul.";
      missingReason = null;
    } else if (value != null) {
      displayValue = formatNumber(value);
      interpretation = `Monotonie descriptive calculée sur les sept jours connus : ${displayValue}.`;
    } else missingReason = "Sept charges quotidiennes connues sont nécessaires.";
  } else if (key === "spacing") {
    const recovery = metrics.recovery;
    if (recovery?.status === "window_elapsed") {
      displayValue = "Terminée";
      interpretation = "La fenêtre d'espacement configurée est terminée ; cela ne prouve pas une récupération complète.";
      missingReason = null;
    } else if (recovery?.rangeHoursMin != null && recovery?.rangeHoursMax != null) {
      displayValue = `${recovery.rangeHoursMin}–${recovery.rangeHoursMax}`;
      unit = "h";
      interpretation = `Il reste ${displayValue} h dans la fenêtre de programmation configurée.`;
      missingReason = null;
    } else missingReason = "Aucune séance récente avec date, heure et statut validé n'est disponible.";
  } else if (key === "dataQuality") {
    value = Math.min(metrics.observedDays ?? 0, 28);
    displayValue = `${value}/28`;
    interpretation = metrics.known28
      ? "Les fenêtres de 7 et 28 jours sont complètes."
      : metrics.known7
        ? "La fenêtre de 7 jours est complète ; celle de 28 jours reste partielle."
        : "Au moins un jour récent reste inconnu ; confirme les repos et complète les durées/RPE.";
    missingReason = null;
  } else if (key === "acwrExperimental") {
    value = metrics.acwr;
    if (value != null) {
      displayValue = Number(value).toFixed(2);
      interpretation = `Ratio expérimental observé : ${displayValue}. Aucune catégorie de risque n'est appliquée.`;
    } else missingReason = "Le ratio reste masqué tant que 28 jours consécutifs ne sont pas connus ou que l'EWMA longue vaut zéro.";
  }

  return {
    key,
    ...definition,
    value,
    displayValue,
    unit,
    available: missingReason == null || value != null,
    interpretation,
    missingReason,
  };
}

export function getMonitoringOverview(metrics = {}) {
  return ["wellness", "load7", "load28", "ewmaAcute", "ewmaChronic", "dataQuality"]
    .map((key) => getMonitoringReading(key, metrics));
}

function formatPercent(value) {
  return `${value > 0 ? "+" : ""}${Math.round(value)} %`;
}

/**
 * Traduit les mesures descriptives en une histoire courte destinée à
 * l'athlète. Les seuils servent uniquement à choisir des mots lisibles : ils
 * ne définissent ni une zone optimale, ni un danger, ni une prescription.
 */
export function getAthleteLoadStory(metrics = {}, sessions = [], athleteId, now = new Date()) {
  const variation = Number.isFinite(metrics.variationPercent) ? metrics.variationPercent : null;
  let headline = "Complète ton historique de charge";
  let summary = "Il manque encore quelques jours renseignés pour comparer cette semaine à tes habitudes.";
  let tone = "neutral";

  if (variation != null) {
    if (variation >= 25) {
      headline = "Ta charge est nettement plus élevée que d’habitude";
      summary = `Ta moyenne quotidienne a augmenté de ${formatPercent(variation)} par rapport aux 3 semaines précédentes.`;
      tone = "up";
    } else if (variation >= 10) {
      headline = "Ta charge est un peu plus élevée que d’habitude";
      summary = `Ta moyenne quotidienne a augmenté de ${formatPercent(variation)} par rapport aux 3 semaines précédentes.`;
      tone = "up";
    } else if (variation <= -25) {
      headline = "Ta charge a nettement diminué cette semaine";
      summary = `Ta moyenne quotidienne a diminué de ${Math.abs(Math.round(variation))} % par rapport aux 3 semaines précédentes.`;
      tone = "down";
    } else if (variation <= -10) {
      headline = "Ta charge a un peu diminué cette semaine";
      summary = `Ta moyenne quotidienne a diminué de ${Math.abs(Math.round(variation))} % par rapport aux 3 semaines précédentes.`;
      tone = "down";
    } else {
      headline = "Ta charge est stable";
      summary = "Ta moyenne quotidienne reste proche de celle de tes 3 semaines précédentes.";
      tone = "stable";
    }
  }

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const contributions = (sessions ?? [])
    .map((session) => {
      const validation = session.validations?.find((item) => item.athleteId === athleteId);
      const date = session.sessionDate ? new Date(`${String(session.sessionDate).slice(0, 10)}T12:00:00`) : null;
      const duration = Number(validation?.actualDurationMinutes);
      const rpe = Number(validation?.rpe);
      const load = Number.isFinite(duration) && duration > 0 && Number.isFinite(rpe) && rpe >= 0 && rpe <= 10
        ? Math.round(duration * rpe)
        : null;
      return { session, validation, date, load, rpe };
    })
    .filter((item) => item.date && item.date >= start && item.date <= end && item.load != null)
    .sort((a, b) => b.date - a.date);

  const total = contributions.reduce((sum, item) => sum + item.load, 0);
  const lastTwo = contributions.slice(0, 2);
  const lastTwoShare = total > 0 ? Math.round((lastTwo.reduce((sum, item) => sum + item.load, 0) / total) * 100) : null;
  let cause = contributions.length
    ? `${contributions.length} séance${contributions.length > 1 ? "s" : ""} renseignée${contributions.length > 1 ? "s" : ""} expliquent la charge de cette semaine.`
    : "Renseigne la durée réellement effectuée et ton effort après les séances pour voir ce qui influence la courbe.";

  if (lastTwo.length === 2 && lastTwoShare >= 55) {
    cause = `Tes deux dernières séances représentent ${lastTwoShare} % de la charge de cette semaine.`;
  }

  const hardSessions = contributions.filter((item) => item.rpe >= 7);
  if (hardSessions.length >= 2) {
    const gapDays = Math.abs(hardSessions[0].date - hardSessions[1].date) / 86_400_000;
    if (gapDays <= 2) {
      cause = `Tu as enchaîné ${hardSessions.length} séances ressenties difficiles sur une période courte. Parles-en avec ton coach si ce rythme ne correspond pas au programme.`;
    }
  }

  return {
    headline,
    summary,
    cause,
    tone,
    variationLabel: variation == null ? "Comparaison indisponible" : formatPercent(variation),
    convention: "AthleteOS considère la charge stable entre −10 % et +10 %. Ces repères servent à expliquer la courbe, pas à définir un risque ou une zone idéale.",
  };
}
