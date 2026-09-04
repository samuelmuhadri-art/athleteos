export function getRecentFeedbacks(sessions = [], athletes = [], { now = new Date(), days = 7, limit = 6 } = {}) {
  const athleteById = new Map(athletes.map(athlete => [athlete.id, athlete]));
  const cutoff = now.getTime() - days * 86_400_000;
  return sessions.flatMap(session => (session.validations ?? []).map(validation => ({
    session, validation, athlete:athleteById.get(validation.athleteId),
    submittedAt:validation.feedbackSubmittedAt ?? (session.sessionDate ? `${session.sessionDate.slice(0, 10)}T12:00:00` : null),
  }))).filter(item => item.athlete && (item.validation.feeling != null || item.validation.comment || item.validation.rpe != null)
    && item.submittedAt && new Date(item.submittedAt).getTime() >= cutoff && new Date(item.submittedAt).getTime() <= now.getTime())
    .sort((first, second) => new Date(second.submittedAt) - new Date(first.submittedAt))
    .slice(0, limit);
}
