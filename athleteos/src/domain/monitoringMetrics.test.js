import { describe, expect, it } from "vitest";
import { getAthleteLoadStory, getMonitoringOverview, getMonitoringReading } from "./monitoringMetrics.js";

describe("panneau de mesures descriptives", () => {
  it("n'invente aucune valeur quand l'historique est incomplet", () => {
    const reading = getMonitoringReading("load7", { load7: null });
    expect(reading.displayValue).toBe("—");
    expect(reading.available).toBe(false);
    expect(reading.missingReason).toContain("jour inconnu");
  });

  it("explique explicitement une monotonie indéfinie", () => {
    const reading = getMonitoringReading("monotony", { monotony: null, monotonyStatus: "undefined_zero_variance" });
    expect(reading.displayValue).toBe("Indéfinie");
    expect(reading.interpretation).toContain("écart-type est nul");
  });

  it("présente l'ACWR uniquement comme expérimental", () => {
    const reading = getMonitoringReading("acwrExperimental", { acwr: 1.42 });
    expect(reading.kind).toBe("Métrique de recherche");
    expect(reading.limits).toContain("Aucune zone optimale");
  });

  it("fournit six lignes principales sans readiness, forme, fatigue ou risque", () => {
    const overview = getMonitoringOverview({});
    expect(overview).toHaveLength(6);
    expect(overview.map((item) => item.key)).toEqual([
      "wellness", "load7", "load28", "ewmaAcute", "ewmaChronic", "dataQuality",
    ]);
  });

  it("traduit une hausse en langage simple sans inventer une zone de risque", () => {
    const story = getAthleteLoadStory({ variationPercent: 31 }, [], 7, new Date("2026-07-29T12:00:00"));
    expect(story.headline).toBe("Ta charge est nettement plus élevée que d’habitude");
    expect(story.summary).toContain("+31 %");
    expect(story.convention).toContain("pas à définir un risque");
  });

  it("explique quand les deux dernières séances dominent la semaine", () => {
    const sessions = [
      { sessionDate: "2026-07-29", validations: [{ athleteId: 7, rpe: 6, actualDurationMinutes: 60 }] },
      { sessionDate: "2026-07-27", validations: [{ athleteId: 7, rpe: 6, actualDurationMinutes: 50 }] },
      { sessionDate: "2026-07-25", validations: [{ athleteId: 7, rpe: 3, actualDurationMinutes: 20 }] },
    ];
    const story = getAthleteLoadStory({ variationPercent: 5 }, sessions, 7, new Date("2026-07-29T12:00:00"));
    expect(story.headline).toBe("Ta charge est stable");
    expect(story.cause).toContain("deux dernières séances représentent");
  });
});
