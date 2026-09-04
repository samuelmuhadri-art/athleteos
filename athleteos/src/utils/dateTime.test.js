import { describe, expect, it } from "vitest";
import {
  calendarDayDifference,
  civilDateKey,
  formatCivilDate,
  formatLocalTimestamp,
  parseCivilDate,
  timestampDayKey,
} from "./dateTime";

describe("convention date civile", () => {
  it.each(["Europe/Brussels", "Europe/Sofia", "America/New_York", "Asia/Tokyo"])(
    "garde le 12 septembre indépendamment de la timezone d'affichage (%s)",
    timeZone => {
      expect(civilDateKey("2026-09-12")).toBe("2026-09-12");
      expect(parseCivilDate("2026-09-12").getDate()).toBe(12);
      expect(formatCivilDate("2026-09-12", { day: "2-digit", month: "2-digit", year: "numeric" }, "fr-BE", timeZone)).toBe("12/09/2026");
    },
  );

  it("gère année bissextile et changement d'année", () => {
    expect(civilDateKey("2028-02-29")).toBe("2028-02-29");
    expect(calendarDayDifference("2026-12-31T22:00:00Z", "2027-01-01T22:00:00Z", "Europe/Brussels")).toBe(1);
  });

  it("conserve le jour local d'un Date autour de minuit", () => {
    expect(civilDateKey(new Date(2026, 8, 5, 0, 30))).toBe("2026-09-05");
  });
});

describe("timestamp réel", () => {
  const instant = "2026-09-03T14:35:00Z";

  it.each([
    ["Europe/Brussels", "16:35"],
    ["Europe/Sofia", "17:35"],
    ["America/New_York", "10:35"],
    ["Asia/Tokyo", "23:35"],
  ])("affiche l'heure locale en %s", (timeZone, expected) => {
    expect(formatLocalTimestamp(instant, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "fr-BE", timeZone)).toBe(expected);
  });

  it("respecte un passage DST européen", () => {
    expect(timestampDayKey("2026-03-29T00:30:00Z", "Europe/Brussels")).toBe("2026-03-29");
    expect(formatLocalTimestamp("2026-03-29T01:30:00Z", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "fr-BE", "Europe/Brussels")).toBe("03:30");
  });
});
