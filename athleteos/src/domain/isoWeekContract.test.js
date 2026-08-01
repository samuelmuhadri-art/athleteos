import { describe, expect, it } from "vitest";
import { getIsoWeekContext } from "../../supabase/functions/_shared/isoWeek";

describe("semaine ISO partagée avec les crons", () => {
  it.each([
    ["2026-01-01", { week: 1, year: 2026, startDate: "2025-12-29", endDate: "2026-01-04" }],
    ["2027-01-01", { week: 53, year: 2026, startDate: "2026-12-28", endDate: "2027-01-03" }],
    ["2029-12-31", { week: 1, year: 2030, startDate: "2029-12-31", endDate: "2030-01-06" }],
  ])("sépare correctement les années pour %s", (date, expected) => {
    expect(getIsoWeekContext(date)).toMatchObject(expected);
  });

  it("produit une clé stable utilisable pour l’idempotence", () => {
    expect(getIsoWeekContext("2026-08-01").key).toBe("2026-W31");
  });
});
