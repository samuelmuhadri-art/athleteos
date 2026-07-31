import { describe, expect, it } from "vitest";
import {
  computeChargeChartData,
  computePerformanceStability,
  generateContextAnalysis,
  getAthleteMetricsForWeek,
  getStatusLabel,
  getWellnessStatus,
} from "./chargeCalculations.js";

function dailyLoadsFrom(length, load = 100, start = "2026-06-01") {
  const first = new Date(`${start}T00:00:00Z`);
  return Array.from({ length }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(first.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), load };
  });
}

describe("getAthleteMetricsForWeek", () => {
  it("relie chaque source (charge, wellness, séances) au bon champ du résultat", () => {
    const weeklyCharge = [{ athleteId: 1, week: 10, rawLoad: 300, dailyLoads: dailyLoadsFrom(5) }];
    const wellnessData = [{ athleteId: 1, date: "2026-06-05", sleep: 5, energy: 5, soreness: 1, mood: 5, stress: 1 }];
    const sessions = [{
      id: 1, category: "sprint", sessionDate: "2026-06-04", time: "10:00",
      validations: [{ athleteId: 1, status: "done", rpe: 7, actualDurationMinutes: 60 }],
    }];

    const metrics = getAthleteMetricsForWeek(1, weeklyCharge, 10, wellnessData, sessions, "2026-06-05");

    expect(metrics.wellnessScore).toBe(100);
    expect(metrics.recovery.kind).toBe("programming_rule");
    expect(metrics.recovery.lastSession.id).toBe(1);
    expect(metrics.hasDailyLoadData).toBe(true);
    expect(metrics.acwrExperimental).toBe(true);
    expect(metrics.experimental_readiness_v0).toBeNull();
    // 5 jours connus seulement : ni les fenêtres ni l'EWMA ne publient de ratio.
    expect(metrics.load7).toBeNull();
    expect(metrics.acwr).toBeNull();
  });

  it("publie load7/load28/acute/chronic une fois 28 jours continus connus", () => {
    const weeklyCharge = [{ athleteId: 1, week: 10, rawLoad: 300, dailyLoads: dailyLoadsFrom(28, 100) }];
    const metrics = getAthleteMetricsForWeek(1, weeklyCharge, 10, [], [], "2026-06-28");

    expect(metrics.load7).toBe(700);
    expect(metrics.load28).toBe(2800);
    expect(metrics.acute).toBeGreaterThan(0);
    expect(metrics.chronic).toBeGreaterThan(0);
    expect(metrics.wellnessScore).toBeNull();
    expect(metrics.recovery.status).toBe("insufficient_data");
  });

  it("ignore les lignes de charge d'un autre athlète", () => {
    const weeklyCharge = [{ athleteId: 2, week: 10, rawLoad: 999, dailyLoads: dailyLoadsFrom(28) }];
    const metrics = getAthleteMetricsForWeek(1, weeklyCharge, 10, [], [], "2026-06-28");
    expect(metrics.hasDailyLoadData).toBe(false);
    expect(metrics.load7).toBeNull();
  });
});

describe("getWellnessStatus / getStatusLabel", () => {
  it.each([
    [null, "Comment te sens-tu aujourd’hui ?"],
    [80, "Tu te sens bien aujourd’hui"],
    [60, "Tu te sens plutôt bien"],
    [30, "Ton ressenti est mitigé"],
    [10, "Ta journée semble difficile"],
  ])("score %s -> %s", (score, label) => {
    expect(getWellnessStatus(score).label).toBe(label);
  });

  it("getStatusLabel est un alias direct de getWellnessStatus", () => {
    expect(getStatusLabel(80)).toEqual(getWellnessStatus(80));
  });
});

describe("computeChargeChartData", () => {
  it("garde au maximum les 12 dernières semaines, triées", () => {
    const weeklyCharge = Array.from({ length: 15 }, (_, i) => ({ athleteId: 1, week: i + 1, rawLoad: (i + 1) * 10 }));
    const result = computeChargeChartData(1, weeklyCharge);
    expect(result).toHaveLength(12);
    expect(result[0]).toEqual({ label: "S4", rawLoad: 40 });
    expect(result.at(-1)).toEqual({ label: "S15", rawLoad: 150 });
  });

  it("renvoie un tableau vide sans donnée pour cet athlète", () => {
    expect(computeChargeChartData(1, [{ athleteId: 2, week: 1, rawLoad: 100 }])).toEqual([]);
  });
});

describe("generateContextAnalysis", () => {
  it("signale un historique incomplet quand load7/load28 manquent", () => {
    const lines = generateContextAnalysis({ load7: null, load28: null }, null);
    expect(lines[0]).toContain("Historique quotidien incomplet");
  });

  it("signale une monotonie non définie plutôt que d'afficher un chiffre inventé", () => {
    const lines = generateContextAnalysis({ load7: 100, load28: 400, monotonyStatus: "undefined_zero_variance" }, null);
    expect(lines.some(line => line.includes("Monotonie non définie"))).toBe(true);
  });

  it("décrit la fenêtre d'espacement sans jamais dire « récupéré »", () => {
    const lines = generateContextAnalysis({
      load7: 100, load28: 400, recovery: { status: "spacing_active", rangeHoursMin: 10, rangeHoursMax: 20 },
    }, null);
    expect(lines.some(line => line.includes("10–20 h"))).toBe(true);
  });

  it("adapte le message à la proximité d'une compétition", () => {
    const now = Date.now();
    const soon = new Date(now + 2 * 86_400_000).toISOString().slice(0, 10);
    const lines = generateContextAnalysis({ load7: 100, load28: 400 }, { name: "Meeting", date: soon });
    expect(lines.some(line => line.includes("activation, réduire la charge"))).toBe(true);
  });

  it("décrit la charge observée dès que load7/load28 sont connus", () => {
    expect(generateContextAnalysis({ load7: 100, load28: 400 }, null)).toEqual(["Charge observée : 100 u sur 7 jours et 400 u sur 28 jours."]);
  });
});

describe("computePerformanceStability", () => {
  it("refuse un historique de moins de 3 points", () => {
    expect(computePerformanceStability([{ value: "10" }, { value: "11" }])).toBeNull();
  });

  it("donne 100 pour des valeurs parfaitement stables", () => {
    const history = [{ value: "10" }, { value: "10" }, { value: "10" }];
    expect(computePerformanceStability(history)).toBe(100);
  });

  it("baisse le score quand les valeurs varient beaucoup", () => {
    const history = [{ value: "10" }, { value: "20" }, { value: "5" }, { value: "18" }];
    const score = computePerformanceStability(history);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("ignore les valeurs non numériques ou nulles", () => {
    const history = [{ value: "10" }, { value: "abc" }, { value: "0" }, { value: "10" }, { value: "10" }];
    expect(computePerformanceStability(history)).toBe(100);
  });
});
