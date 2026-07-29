export const ATTENDANCE_OPTIONS = Object.freeze([
  { id: "present", label: "Présent", tone: "success" },
  { id: "late", label: "En retard", tone: "warning" },
  { id: "absent", label: "Absent", tone: "danger" },
  { id: "injured", label: "Blessé", tone: "danger" },
]);

export const RSVP_OPTIONS = Object.freeze([
  { id: "going", label: "Je serai présent" },
  { id: "unsure", label: "Je ne sais pas encore" },
  { id: "unavailable", label: "Je ne peux pas venir" },
]);

function inferredAttendance(validation) {
  if (validation?.attendanceStatus) return validation.attendanceStatus;
  if (validation?.status === "none") return "absent";
  if (validation?.status === "done" || validation?.status === "partial") return "present";
  return null;
}

export function hasCompleteSessionFeedback(validation) {
  return (validation?.status === "done" || validation?.status === "partial")
    && validation?.rpe != null
    && validation?.durationSource === "reported"
    && Number(validation?.actualDurationMinutes) > 0;
}

export function getSessionDaySummary(session) {
  const validations = session?.validations ?? [];
  const summary = {
    total: session?.athleteIds?.length ?? validations.length,
    present: 0, late: 0, absent: 0, injured: 0, pendingAttendance: 0,
    feedbackComplete: 0, feedbackMissing: 0, difficult: 0,
    totalLoad: 0, averageRpe: null,
  };
  const rpes = [];
  validations.forEach((validation) => {
    const attendance = inferredAttendance(validation);
    if (attendance && Object.hasOwn(summary, attendance)) summary[attendance] += 1;
    else summary.pendingAttendance += 1;
    if (hasCompleteSessionFeedback(validation)) {
      summary.feedbackComplete += 1;
      rpes.push(Number(validation.rpe));
      summary.totalLoad += Math.round(Number(validation.actualDurationMinutes) * Number(validation.rpe));
      if (Number(validation.rpe) >= 8 || (validation.feeling != null && Number(validation.feeling) <= 2)) summary.difficult += 1;
    } else if (attendance !== "absent" && attendance !== "injured") {
      summary.feedbackMissing += 1;
    }
  });
  summary.averageRpe = rpes.length ? Math.round((rpes.reduce((sum, value) => sum + value, 0) / rpes.length) * 10) / 10 : null;
  return summary;
}

export function getSessionDayMessage(summary) {
  if (!summary.total) return "Ajoute des athlètes pour préparer le suivi de cette séance.";
  if (summary.pendingAttendance > 0) return `${summary.pendingAttendance} présence${summary.pendingAttendance > 1 ? "s" : ""} reste${summary.pendingAttendance > 1 ? "nt" : ""} à confirmer.`;
  if (summary.feedbackMissing > 0) return `${summary.feedbackMissing} retour${summary.feedbackMissing > 1 ? "s" : ""} de séance manque${summary.feedbackMissing > 1 ? "nt" : ""} encore.`;
  if (summary.difficult > 0) return `${summary.difficult} athlète${summary.difficult > 1 ? "s ont" : " a"} trouvé la séance nettement difficile.`;
  return "Les présences et les retours de séance sont à jour.";
}
