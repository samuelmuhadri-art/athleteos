import { describe, expect, it } from "vitest";
import { getAthleteSessionStatus, getTodayFocus } from "./dashboardFocus";

const session = (id, status = "future") => ({
  id,
  title: `Séance ${id}`,
  validations: [{ athleteId: "athlete-1", status }],
});

describe("dashboard athlete daily focus", () => {
  it("demande le wellness avant la séance pour fiabiliser l'état du jour", () => {
    const focus = getTodayFocus({
      wellnessCompleted: false,
      todaySessions: [session("speed")],
      athleteId: "athlete-1",
    });

    expect(focus.kind).toBe("wellness");
    expect(focus.focusSession?.id).toBe("speed");
    expect(focus.completedSteps).toBe(0);
    expect(focus.totalSteps).toBe(2);
  });

  it("sélectionne la première séance encore à traiter et non la première de la journée", () => {
    const focus = getTodayFocus({
      wellnessCompleted: true,
      todaySessions: [session("morning", "done"), session("evening", "future")],
      athleteId: "athlete-1",
    });

    expect(focus.kind).toBe("session");
    expect(focus.focusSession.id).toBe("evening");
    expect(focus.completedSessions).toBe(1);
    expect(focus.completedSteps).toBe(2);
  });

  it("considère une absence encodée comme traitée", () => {
    const focus = getTodayFocus({
      wellnessCompleted: true,
      todaySessions: [session("medical", "none")],
      athleteId: "athlete-1",
    });

    expect(focus.kind).toBe("complete");
    expect(focus.pendingSessions).toEqual([]);
  });

  it("affiche une journée libre quand wellness est rempli et aucune séance n'est prévue", () => {
    expect(getTodayFocus({ wellnessCompleted: true, todaySessions: [], athleteId: "athlete-1" }))
      .toMatchObject({ kind: "free", completedSteps: 1, totalSteps: 1, focusSession: null });
  });

  it("isole correctement le statut de l'athlète dans une séance de groupe", () => {
    const groupSession = {
      validations: [
        { athleteId: "athlete-2", status: "done" },
        { athleteId: "athlete-1", status: "partial" },
      ],
    };
    expect(getAthleteSessionStatus(groupSession, "athlete-1")).toBe("partial");
    expect(getAthleteSessionStatus(groupSession, "unknown")).toBe("future");
  });
});
