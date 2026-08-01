import { getAthleteMetricsForWeek } from "../utils/chargeCalculations.js";
import { getISOWeekYear, matchesISOWeek } from "../utils/helpers.js";

const finite = (value) => Number.isFinite(Number(value)) && value !== null && value !== "";

export function getWeeklyLoadRow(
  weeklyCharge,
  athleteId,
  week,
  isoYear = getISOWeekYear(new Date()),
) {
  return (weeklyCharge ?? []).find((row) =>
    row.athleteId === athleteId && matchesISOWeek(row, week, isoYear)
  ) ?? null;
}

export function getWeeklyLoadState(row) {
  if (!row) {
    return {
      kind: "missing",
      value: null,
      label: "À renseigner",
      detail: "Aucune journée n'est encore renseignée pour cette semaine.",
      color: "#64748B",
      badgeClass: "bg-[rgba(100,116,139,0.15)] text-[#A8B4C5]",
    };
  }

  if (!finite(row.rawLoad)) {
    return {
      kind: "incomplete",
      value: null,
      label: "À compléter",
      detail: "Au moins une séance attend encore sa durée réelle ou son effort ressenti.",
      color: "#EF9F27",
      badgeClass: "bg-[rgba(239,159,39,0.14)] text-[#F3C77D]",
    };
  }

  const value = Number(row.rawLoad);
  if (value === 0) {
    return {
      kind: "zero",
      value,
      label: "0 renseigné",
      detail: "Le repos ou l'absence de charge a bien été confirmé : ce zéro est une donnée connue.",
      color: "#14B8A6",
      badgeClass: "bg-[rgba(20,184,166,0.14)] text-[#76D7CC]",
    };
  }

  return {
    kind: "observed",
    value,
    label: "Renseignée",
    detail: "La durée réellement effectuée et l'effort ressenti ont permis de calculer cette charge.",
    color: "#378ADD",
    badgeClass: "bg-[rgba(55,138,221,0.15)] text-[#A9CBFB]",
  };
}

export function describeLoadVariation(value) {
  const variation = finite(value) ? Number(value) : null;
  if (variation == null) {
    return {
      tone: "neutral",
      label: "Habitude en construction",
      summary: "Il manque encore des journées connues pour comparer les 7 derniers jours aux 3 semaines précédentes.",
      valueLabel: "Comparaison indisponible",
    };
  }

  const rounded = Math.round(variation);
  const valueLabel = `${rounded > 0 ? "+" : ""}${rounded} %`;
  if (rounded >= 25) return {
    tone: "up",
    label: "Nettement plus que d'habitude",
    summary: "La moyenne quotidienne des 7 derniers jours est nettement plus élevée que celle des 3 semaines précédentes.",
    valueLabel,
  };
  if (rounded >= 10) return {
    tone: "up",
    label: "Un peu plus que d'habitude",
    summary: "La moyenne quotidienne des 7 derniers jours est un peu plus élevée que celle des 3 semaines précédentes.",
    valueLabel,
  };
  if (rounded <= -25) return {
    tone: "down",
    label: "Nettement moins que d'habitude",
    summary: "La moyenne quotidienne des 7 derniers jours est nettement plus basse que celle des 3 semaines précédentes.",
    valueLabel,
  };
  if (rounded <= -10) return {
    tone: "down",
    label: "Un peu moins que d'habitude",
    summary: "La moyenne quotidienne des 7 derniers jours est un peu plus basse que celle des 3 semaines précédentes.",
    valueLabel,
  };
  return {
    tone: "stable",
    label: "Proche de l'habitude",
    summary: "La moyenne quotidienne des 7 derniers jours reste proche de celle des 3 semaines précédentes.",
    valueLabel,
  };
}

export function buildGroupLoadOverview(rows) {
  const current = (rows ?? []).filter((item) => finite(item.rawLoad));
  const paired = current.filter((item) => finite(item.previousRawLoad));
  const load7 = (rows ?? []).map((item) => item.metrics?.load7).filter(finite).map(Number);
  const positive = current.filter((item) => Number(item.rawLoad) > 0);
  const mean = (values) => values.length
    ? values.reduce((sum, value) => sum + Number(value), 0) / values.length
    : null;
  const pairedCurrentMean = mean(paired.map((item) => item.rawLoad));
  const pairedPreviousMean = mean(paired.map((item) => item.previousRawLoad));
  const trendPercent = pairedCurrentMean != null && pairedPreviousMean > 0
    ? Math.round(((pairedCurrentMean - pairedPreviousMean) / pairedPreviousMean) * 100)
    : null;

  return {
    avgLoad: current.length ? Math.round(mean(current.map((item) => item.rawLoad))) : null,
    avgLoad7: load7.length ? Math.round(mean(load7)) : null,
    topLoader: positive.sort((a, b) => Number(b.rawLoad) - Number(a.rawLoad))[0] ?? null,
    observedCount: current.length,
    pairedCount: paired.length,
    trendPercent,
  };
}

export function buildGroupLoadStory(rows) {
  const known = (rows ?? []).filter((item) => finite(item.metrics?.variationPercent));
  const higher = known.filter((item) => Number(item.metrics.variationPercent) >= 10);
  const lower = known.filter((item) => Number(item.metrics.variationPercent) <= -10);
  const stable = known.filter((item) => Math.abs(Number(item.metrics.variationPercent)) < 10);

  if (!known.length) return {
    headline: "L'habitude du groupe est encore en construction",
    detail: "Confirme les jours de repos et complète les durées réelles et efforts ressentis. Dès que 28 jours sont connus, AthleteOS compare les 7 derniers jours aux 3 semaines précédentes.",
    counts: { higher: 0, stable: 0, lower: 0, known: 0 },
  };

  let headline = "La charge du groupe reste proche de ses habitudes";
  if (higher.length && lower.length) headline = "Les charges évoluent différemment dans le groupe";
  else if (higher.length) headline = `${higher.length} athlète${higher.length > 1 ? "s ont" : " a"} davantage chargé récemment`;
  else if (lower.length) headline = `${lower.length} athlète${lower.length > 1 ? "s ont" : " a"} moins chargé récemment`;

  return {
    headline,
    detail: `Comparaison lisible pour ${known.length} athlète${known.length > 1 ? "s" : ""} : ${higher.length} au-dessus de l'habitude, ${stable.length} proche${stable.length > 1 ? "s" : ""} de l'habitude et ${lower.length} en dessous. Ces mots décrivent un changement, pas un danger ni une prescription.`,
    counts: { higher: higher.length, stable: stable.length, lower: lower.length, known: known.length },
  };
}

export function athleteSeriesKey(athleteId) {
  return `athlete_${String(athleteId).replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

export function buildExperimentalAcwrSeries(athletes, weeklyCharge) {
  const allWeeks = [...new Map((weeklyCharge ?? []).map((row) => {
    const isoYear = Number.isInteger(Number(row.isoYear)) ? Number(row.isoYear) : null;
    const key = `${isoYear ?? "legacy"}-${row.week}`;
    const cutoffDate = (row.dailyLoads ?? []).map((day) => day.date).filter(Boolean).sort().at(-1) ?? null;
    return [key, { week: row.week, isoYear, cutoffDate }];
  })).values()].sort((a, b) => (a.isoYear ?? 0) - (b.isoYear ?? 0) || a.week - b.week);
  return allWeeks.map(({ week, isoYear, cutoffDate }) => {
    const point = { label: isoYear == null ? `S${week}` : `S${week} · ${isoYear}` };
    (athletes ?? []).forEach((athlete) => {
      point[athleteSeriesKey(athlete.id)] = getAthleteMetricsForWeek(
        athlete.id,
        weeklyCharge,
        week,
        [],
        [],
        cutoffDate,
      ).acwr;
    });
    return point;
  });
}
