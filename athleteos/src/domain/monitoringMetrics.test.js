import { describe, expect, it } from "vitest";
import { getMonitoringOverview, getMonitoringReading } from "./monitoringMetrics.js";

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
});
