// Profil descriptif des contraintes AthleteOS.
// Les poids ventilent la charge session-RPE entre six dimensions séparées.
// Ils ne modifient jamais la charge totale et ne prédisent aucun risque.

export const CURRENT_AXIS_MODEL_VERSION = "v1";

export const LOAD_AXES = {
  neuromuscular: { label: "Nerveux", nounPhrase: "neuromusculaire", what: "Vitesse et force maximale : sprints, départs, charges lourdes.", color: "#E24B4A" },
  elastic: { label: "Élastique", nounPhrase: "élastique", what: "Bonds et rebonds : exposition aux impacts répétés.", color: "#EF9F27" },
  metabolic: { label: "Métabolique", nounPhrase: "métabolique", what: "Efforts prolongés et travail d'endurance.", color: "#378ADD" },
  muscular: { label: "Musculaire", nounPhrase: "musculaire", what: "Travail musculaire et musculation.", color: "#A855F7" },
  technical: { label: "Technique", nounPhrase: "technique", what: "Apprentissage et répétition d'un geste précis.", color: "#14B8A6" },
  mental: { label: "Mental", nounPhrase: "mentale", what: "Concentration et exigences perçues de la séance.", color: "#EC4899" },
};

const AXIS_IDS = Object.keys(LOAD_AXES);

// Convention de coaching configurable. Ces poids ne sont pas des coefficients
// de charge : la somme session-RPE reste durée réelle × RPE.
export const AXIS_WEIGHTS = {
  sprint:       { neuromuscular: 1.0, elastic: 0.7, metabolic: 0.3, muscular: 0.3, technical: 0.5, mental: 0.4 },
  haies:        { neuromuscular: 0.9, elastic: 0.8, metabolic: 0.3, muscular: 0.3, technical: 0.8, mental: 0.5 },
  force:        { neuromuscular: 0.6, elastic: 0.3, metabolic: 0.3, muscular: 1.0, technical: 0.3, mental: 0.3 },
  saut:         { neuromuscular: 0.8, elastic: 1.0, metabolic: 0.3, muscular: 0.4, technical: 0.8, mental: 0.5 },
  lancer:       { neuromuscular: 0.7, elastic: 0.5, metabolic: 0.2, muscular: 0.7, technical: 0.9, mental: 0.4 },
  endurance:    { neuromuscular: 0.2, elastic: 0.2, metabolic: 1.0, muscular: 0.3, technical: 0.2, mental: 0.3 },
  technique:    { neuromuscular: 0.3, elastic: 0.3, metabolic: 0.2, muscular: 0.2, technical: 1.0, mental: 0.3 },
  mobilite:     { neuromuscular: 0.1, elastic: 0.2, metabolic: 0.1, muscular: 0.1, technical: 0.2, mental: 0.2 },
  recuperation: { neuromuscular: 0.05, elastic: 0.05, metabolic: 0.1, muscular: 0.05, technical: 0.05, mental: 0.1 },
};

export function computeSessionAxisLoads(actualDurationMinutes, rpe, category) {
  const duration = Number(actualDurationMinutes);
  const effort = Number(rpe);
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(effort) || effort < 0 || effort > 10) return null;
  const base = duration * effort;
  const weights = AXIS_WEIGHTS[category] ?? AXIS_WEIGHTS.technique;
  return Object.fromEntries(AXIS_IDS.map(axis => [axis, Math.round(base * (weights[axis] ?? 0))]));
}

export function computeWeeklyAxisLoads(athleteId, sessions) {
  const byWeek = new Map();
  (sessions ?? []).forEach(session => {
    if (!session.athleteIds?.includes(athleteId)) return;
    const validation = session.validations?.find(item => item.athleteId === athleteId);
    const loads = computeSessionAxisLoads(validation?.actualDurationMinutes, validation?.rpe, session.category);
    if (!loads) return;
    if (!byWeek.has(session.week)) byWeek.set(session.week, Object.fromEntries(AXIS_IDS.map(axis => [axis, 0])));
    AXIS_IDS.forEach(axis => { byWeek.get(session.week)[axis] += loads[axis]; });
  });
  return [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([week, loads]) => ({ week, loads }));
}

export function axisStatus(score) {
  if (score >= 75) return { label: "Dominant", color: "#A9CBFB" };
  if (score >= 40) return { label: "Présent", color: "#7BD8B4" };
  return { label: "Secondaire", color: "#94A3B8" };
}

function axisDataQuality(weeksOfData) {
  if (weeksOfData >= 8) return "élevée";
  if (weeksOfData >= 4) return "modérée";
  return "faible";
}

export function getAthleteAxisProfile(athleteId, sessions, currentWeek) {
  const cutoff = Number.isFinite(currentWeek) ? currentWeek : Infinity;
  const weekly = computeWeeklyAxisLoads(athleteId, sessions).filter(item => item.week <= cutoff);
  if (!weekly.length) return null;

  const current = weekly.at(-1);
  const baselineWeeks = weekly.slice(-5, -1);
  const maxCurrentLoad = Math.max(1, ...AXIS_IDS.map(axis => current.loads[axis]));
  const profile = {};
  AXIS_IDS.forEach(axis => {
    const currentLoad = current.loads[axis];
    const habitualLoad = baselineWeeks.length
      ? Math.round(baselineWeeks.reduce((sum, week) => sum + week.loads[axis], 0) / baselineWeeks.length)
      : null;
    const variationPercent = habitualLoad > 0 ? Math.round(((currentLoad - habitualLoad) / habitualLoad) * 100) : null;
    const score = Math.round((currentLoad / maxCurrentLoad) * 100);
    profile[axis] = {
      score, ...axisStatus(score), currentLoad, habitualLoad, variationPercent,
      dataQuality: axisDataQuality(weekly.length), weeksOfData: weekly.length, currentWeek: current.week,
    };
  });
  return profile;
}

export function getAxisTopContributors(athleteId, sessions, axis, currentWeek, limit = 3) {
  return (sessions ?? [])
    .filter(session => session.week != null && session.week >= currentWeek - 1 && session.week <= currentWeek)
    .filter(session => session.athleteIds?.includes(athleteId))
    .map(session => {
      const validation = session.validations?.find(item => item.athleteId === athleteId);
      const loads = computeSessionAxisLoads(validation?.actualDurationMinutes, validation?.rpe, session.category);
      if (!loads?.[axis]) return null;
      return { id: session.id, title: session.title, category: session.category, week: session.week, sessionDate: session.sessionDate, axisLoad: loads[axis] };
    })
    .filter(Boolean)
    .sort((a, b) => b.axisLoad - a.axisLoad)
    .slice(0, limit);
}
