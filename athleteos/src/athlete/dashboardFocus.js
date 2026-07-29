// Logique pure du bloc "Aujourd'hui" du dashboard athlète.
// Gardée hors du composant pour que la priorité affichée reste testable sans UI.

const TERMINAL_SESSION_STATUSES = new Set(["done", "none"]);

export function getAthleteSessionStatus(session, athleteId) {
  return session?.validations?.find(validation => validation.athleteId === athleteId)?.status ?? "future";
}

export function getTodayFocus({ wellnessCompleted, restConfirmed = false, todaySessions = [], athleteId }) {
  const sessions = Array.isArray(todaySessions) ? todaySessions : [];
  const pendingSessions = sessions.filter(
    session => !TERMINAL_SESSION_STATUSES.has(getAthleteSessionStatus(session, athleteId))
  );
  const completedSessions = sessions.length - pendingSessions.length;
  const restStep = sessions.length === 0;
  const completedSteps = completedSessions + (wellnessCompleted ? 1 : 0) + (restStep && restConfirmed ? 1 : 0);
  const totalSteps = sessions.length + 1 + (restStep ? 1 : 0);

  if (!wellnessCompleted) {
    return {
      kind: "wellness",
      completedSteps,
      totalSteps,
      completedSessions,
      pendingSessions,
      focusSession: pendingSessions[0] ?? null,
    };
  }

  if (pendingSessions.length > 0) {
    return {
      kind: "session",
      completedSteps,
      totalSteps,
      completedSessions,
      pendingSessions,
      focusSession: pendingSessions[0],
    };
  }

  if (restStep && !restConfirmed) {
    return {
      kind: "rest",
      completedSteps,
      totalSteps,
      completedSessions,
      pendingSessions,
      focusSession: null,
    };
  }

  return {
    kind: sessions.length > 0 ? "complete" : "free",
    completedSteps,
    totalSteps,
    completedSessions,
    pendingSessions,
    focusSession: null,
  };
}
