export const SESSION_ARCHIVE_AFTER_DAYS = 7;

function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getSessionArchiveCutoff(referenceDate = new Date()) {
  const cutoff = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  cutoff.setDate(cutoff.getDate() - SESSION_ARCHIVE_AFTER_DAYS);
  return toLocalDateKey(cutoff);
}

export function isSessionArchived(session, referenceDate = new Date()) {
  const sessionDate = session?.sessionDate?.slice(0, 10);
  if (!sessionDate) return false;
  return sessionDate <= getSessionArchiveCutoff(referenceDate);
}
