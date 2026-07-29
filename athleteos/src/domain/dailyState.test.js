import { describe, expect, it } from "vitest";
import { buildDailyState, buildGroupDailyState } from "./dailyState";

describe("repère AthleteOS du jour", () => {
  it("normalise le questionnaire sur 0 à 100 et explique les facteurs", () => {
    const state = buildDailyState({ wellness: { date: "2026-08-01", sleep: 5, energy: 4, soreness: 4, mood: 4, stress: 1 } });
    expect(state.score).toBe(75);
    expect(state.label).toBe("De bonnes ressources aujourd'hui");
    expect(state.legacyLabel).toBe("Plutôt favorable");
    expect(state.factors.find(item => item.key === "soreness")).toMatchObject({ tone: "attention" });
    expect(state.summary).toContain("Courbatures");
    expect(state.watch).toContain("Tes courbatures sont marquées");
    expect(state.variation).toBeNull();
  });

  it("utilise la variation actuelle sans la mélanger au score de ressenti", () => {
    const wellness = { sleep: 4, energy: 4, soreness: 2, mood: 4, stress: 2 };
    const stable = buildDailyState({ wellness, metrics: { variationPercent: 5 } });
    const higher = buildDailyState({ wellness, metrics: { variationPercent: 35 } });
    expect(stable.score).toBe(higher.score);
    expect(higher.loadContext).toContain("plus élevée");
  });

  it("compare uniquement à une référence personnelle suffisamment renseignée", () => {
    const history = [60, 70, 80].map((score, index) => ({
      date: `2026-07-${20 + index}`,
      sleep: score >= 70 ? 4 : 3, energy: 4, soreness: 2, mood: 4, stress: 2,
    }));
    expect(buildDailyState({ wellness: { date: "2026-08-01", sleep: 5, energy: 5, soreness: 1, mood: 5, stress: 1 }, history }).baseline).not.toBeNull();
    expect(buildDailyState({ wellness: null, history }).score).toBeNull();
  });

  it("résume le groupe sans inventer les check-ins manquants", () => {
    const group = buildGroupDailyState([{ id: 1 }, { id: 2 }], [{ athleteId: 1, sleep: 5, energy: 5, soreness: 1, mood: 5, stress: 1 }]);
    expect(group).toMatchObject({ completed: 1, favorable: 1, average: 100 });
  });
});
