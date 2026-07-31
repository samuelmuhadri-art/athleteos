import { describe, expect, it } from "vitest";
import { getSessionDayMessage, getSessionDaySummary, hasCompleteSessionFeedback } from "./sessionDay";

describe("suivi du jour de séance", () => {
  it("sépare retours manquants et charge session-RPE", () => {
    const session = {
      athleteIds: [1, 2, 3, 4],
      validations: [
        { athleteId: 1, status: "done", rpe: 8, actualDurationMinutes: 60, durationSource: "reported", feeling: 2 },
        { athleteId: 2, status: "partial", rpe: 5, actualDurationMinutes: 40, durationSource: "reported", feeling: 4 },
        { athleteId: 3, status: "none" },
        { athleteId: 4 },
      ],
    };
    expect(getSessionDaySummary(session)).toMatchObject({
      total: 4, feedbackComplete: 2, feedbackMissing: 1, difficult: 1, totalLoad: 680, averageRpe: 6.5,
    });
  });

  it("reste compatible avec les anciens statuts", () => {
    expect(getSessionDaySummary({ athleteIds: [1, 2], validations: [{ status: "done" }, { status: "none" }] }))
      .toMatchObject({ feedbackMissing: 1 });
    expect(hasCompleteSessionFeedback({ status: "done", rpe: 6, actualDurationMinutes: 50, durationSource: "reported" })).toBe(true);
  });

  it("donne une lecture simple en priorité", () => {
    expect(getSessionDayMessage({ total: 4, feedbackMissing: 1 })).toContain("1 retour");
    expect(getSessionDayMessage({ total: 4, feedbackMissing: 0 })).toContain("à jour");
  });
});
