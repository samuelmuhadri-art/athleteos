export function getPlanningCompetitions(competitions = [], athleteId = null) {
  return competitions.filter(competition => (
    Boolean(competition?.date)
    && (athleteId == null || competition.athleteIds?.includes(athleteId))
  ));
}

export function groupCompetitionsByDate(competitions = [], athleteId = null) {
  return getPlanningCompetitions(competitions, athleteId).reduce((groups, competition) => {
    const date = competition.date.slice(0, 10);
    if (!groups[date]) groups[date] = [];
    groups[date].push(competition);
    return groups;
  }, {});
}
