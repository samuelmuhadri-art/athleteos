// Logique pure du bloc "Aujourd'hui" du dashboard athlète.
// Gardée hors du composant pour que la priorité affichée reste testable sans UI.

const TERMINAL_SESSION_STATUSES = new Set(["done", "none"]);

export function getAthleteSessionStatus(session, athleteId) {
  return session?.validations?.find(validation => validation.athleteId === athleteId)?.status ?? "future";
}

export function getTodayFocus({ wellnessCompleted, wellnessEnabled = true, restConfirmed = false, restTrackingEnabled = true, todaySessions = [], athleteId }) {
  const sessions = Array.isArray(todaySessions) ? todaySessions : [];
  const pendingSessions = sessions.filter(
    session => !TERMINAL_SESSION_STATUSES.has(getAthleteSessionStatus(session, athleteId))
  );
  const completedSessions = sessions.length - pendingSessions.length;
  const restStep = sessions.length === 0 && restTrackingEnabled;
  const completedSteps = completedSessions + (wellnessEnabled && wellnessCompleted ? 1 : 0) + (restStep && restConfirmed ? 1 : 0);
  const totalSteps = sessions.length + (wellnessEnabled ? 1 : 0) + (restStep ? 1 : 0);

  // Le planning reste la première question opérationnelle de l’athlète.
  // Le check-in demeure visible juste après, mais ne masque plus une séance.
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

  if (wellnessEnabled && !wellnessCompleted) {
    return {
      kind: "wellness",
      completedSteps,
      totalSteps,
      completedSessions,
      pendingSessions,
      focusSession: null,
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
