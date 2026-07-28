import { describe, expect, it } from "vitest";
import { computeWellnessScore } from "./chargeCalculations.js";
import { buildMonthlyAggregate, buildWeeklyReport } from "./weeklyReports.js";

const SESSION_WEEK_30 = {
  id: 1,
  week: 30,
  day: "jeudi",
  sessionDate: "2026-07-23",
  category: "vitesse",
  title: "Vitesse",
  durationMinutes: 60,
  athleteIds: [1],
  validations: [{ athleteId: 1, status: "done", rpe: 6 }],
};

describe("buildWeeklyReport", () => {
  it("limite le wellness à la semaine du rapport", () => {
    const selectedWeekWellness = {
      athleteId: 1,
      date: "2026-07-23",
      sleep: 4,
      energy: 4,
      soreness: 2,
      mood: 5,
      stress: 1,
    };
    const followingWeekWellness = {
      athleteId: 1,
      date: "2026-07-30",
      sleep: 1,
      energy: 1,
      soreness: 5,
      mood: 1,
      stress: 5,
    };

    const report = buildWeeklyReport({
      athleteId: 1,
      week: 30,
      sessions: [SESSION_WEEK_30],
      weeklyCharge: [{ athleteId: 1, week: 30, rawLoad: 360 }],
      wellnessRows: [selectedWeekWellness, followingWeekWellness],
    });

    expect(report.wellnessAvg).toBe(computeWellnessScore(selectedWeekWellness));
  });

  it("n'intègre pas une charge postérieure à la semaine consultée", () => {
    const reportWithFutureCharge = buildWeeklyReport({
      athleteId: 1,
      week: 30,
      sessions: [SESSION_WEEK_30],
      weeklyCharge: [
        { athleteId: 1, week: 30, rawLoad: 360 },
        { athleteId: 1, week: 31, rawLoad: 900 },
      ],
    });
    const reportWithoutFutureCharge = buildWeeklyReport({
      athleteId: 1,
      week: 30,
      sessions: [SESSION_WEEK_30],
      weeklyCharge: [{ athleteId: 1, week: 30, rawLoad: 360 }],
    });

    expect(reportWithFutureCharge.metrics.acute).toBe(reportWithoutFutureCharge.metrics.acute);
    expect(reportWithFutureCharge.metrics.acwr).toBe(reportWithoutFutureCharge.metrics.acwr);
  });
});

describe("buildMonthlyAggregate", () => {
  it("n'invente pas de tendance avec une seule semaine", () => {
    const aggregate = buildMonthlyAggregate({
      athleteId: 1,
      weeks: [30],
      sessions: [SESSION_WEEK_30],
      weeklyCharge: [{ athleteId: 1, week: 30, rawLoad: 360 }],
    });

    expect(aggregate.trend).toBe("flat");
    expect(aggregate.weeks).toHaveLength(1);
  });
});
