import { describe, expect, it } from "vitest";
import { dateToWeek, daysUntil, generateResultAnalysis } from "./competitionsShared.js";

describe("helpers du calendrier des compétitions", () => {
  it("considère toute la date du jour comme aujourd'hui", () => {
    const lateToday = new Date(2026, 6, 28, 23, 59, 59);

    expect(daysUntil("2026-07-28", lateToday)).toBe(0);
    expect(daysUntil("2026-07-29", lateToday)).toBe(1);
    expect(daysUntil("2026-07-27", lateToday)).toBe(-1);
  });

  it("utilise les semaines ISO aux changements d'année", () => {
    expect(dateToWeek("2027-01-01")).toBe(53);
    expect(dateToWeek("2027-01-04")).toBe(1);
  });
});

describe("analyse contextuelle d'un résultat", () => {
  it("signale une blessure active mais ignore une blessure résolue", () => {
    const competition = { date: "2026-07-10" };
    const athlete = {
      id: 1,
      injuries: [
        { name: "Cheville", status: "actif", startDate: "2026-07-01" },
        { name: "Épaule", status: "résolu", startDate: "2026-06-01" },
      ],
    };

    const analysis = generateResultAnalysis({}, competition, athlete, []).join(" ");

    expect(analysis).toContain("Cheville");
    expect(analysis).not.toContain("Épaule");
  });
});
