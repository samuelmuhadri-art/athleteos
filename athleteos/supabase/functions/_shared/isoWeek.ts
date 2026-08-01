export type IsoWeekContext = {
  week: number;
  year: number;
  key: string;
  startDate: string;
  endDate: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function localDateInTimeZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function getIsoWeekContext(localDate: string): IsoWeekContext {
  if (!DATE_PATTERN.test(localDate)) throw new Error("Date locale invalide.");
  const date = new Date(`${localDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Date locale invalide.");

  const isoDay = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() - isoDay + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  const thursday = new Date(date);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - isoDay);
  const year = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);

  return {
    week,
    year,
    key: `${year}-W${String(week).padStart(2, "0")}`,
    startDate: formatUtcDate(monday),
    endDate: formatUtcDate(sunday),
  };
}
