import { describe, it, expect } from "vitest";
import {
  buildContinuousDailyLoadSeries,
  computeAllWeeklyLoads,
  computeEWMA,
  computeLoadWindows,
  computeMonotonyAndStrain,
  computeSessionLoad,
  computeWeeklyLoadByCategory,
  computeWeeklyLoadFromSessions,
  computeWellnessScore,
  estimateRecovery,
  extractDailyLoads,
  getRPELabel,
} from "./trainingLoad.js";

function dailySeries(length, load = 100, start = "2026-01-01") {
  const first = new Date(`${start}T00:00:00Z`);
  return Array.from({ length }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(first.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), load: typeof load === "function" ? load(index) : load };
  });
}

describe("session-RPE standard", () => {
  it("calcule durée réelle × RPE CR10, sans division ni coefficient", () => {
    expect(computeSessionLoad(60, 7, "sprint")).toBe(420);
    expect(computeSessionLoad(45, 8, "force")).toBe(360);
    expect(computeSessionLoad(60, 5, "unknown")).toBe(300);
  });

  it("refuse les données absentes ou hors bornes", () => {
    expect(computeSessionLoad(null, 5)).toBeNull();
    expect(computeSessionLoad(60, null)).toBeNull();
    expect(computeSessionLoad(0, 5)).toBeNull();
    expect(computeSessionLoad(60, 11)).toBeNull();
  });
});

describe("agrégation hebdomadaire depuis les séances", () => {
  const sessions = [
    {
      id: 1, week: 10, category: "sprint", athleteIds: [1, 2],
      validations: [
        { athleteId: 1, rpe: 7, actualDurationMinutes: 60 },
        { athleteId: 2, rpe: null, actualDurationMinutes: 60 },
      ],
    },
    {
      id: 2, week: 10, category: "force", athleteIds: [1],
      validations: [{ athleteId: 1, rpe: 5, actualDurationMinutes: 40 }],
    },
    {
      id: 3, week: 11, category: "sprint", athleteIds: [1],
      validations: [{ athleteId: 1, rpe: 6, actualDurationMinutes: 50 }],
    },
  ];

  it("computeWeeklyLoadFromSessions : somme uniquement les séances avec RPE renseigné", () => {
    const result = computeWeeklyLoadFromSessions(1, 10, sessions);
    expect(result.total).toBe(420 + 200);
    expect(result.sessionCount).toBe(2);
    expect(result.missingRpeCount).toBe(0);
  });

  it("computeWeeklyLoadFromSessions : compte les RPE manquants sans les inclure dans le total", () => {
    const result = computeWeeklyLoadFromSessions(2, 10, sessions);
    expect(result.total).toBe(0);
    expect(result.sessionCount).toBe(0);
    expect(result.missingRpeCount).toBe(1);
  });

  it("computeAllWeeklyLoads : une ligne par athlète et par semaine avec au moins une séance validée", () => {
    const result = computeAllWeeklyLoads([{ id: 1 }, { id: 2 }], sessions);
    expect(result).toContainEqual({ athleteId: 1, week: 10, rawLoad: 620 });
    expect(result).toContainEqual({ athleteId: 1, week: 11, rawLoad: 300 });
    expect(result.some((row) => row.athleteId === 2)).toBe(false);
  });

  it("computeWeeklyLoadByCategory : ventile la charge du groupe par semaine et catégorie", () => {
    const result = computeWeeklyLoadByCategory([{ id: 1 }, { id: 2 }], sessions);
    expect(result).toContainEqual({ week: 10, category: "sprint", total: 420 });
    expect(result).toContainEqual({ week: 10, category: "force", total: 200 });
    expect(result).toContainEqual({ week: 11, category: "sprint", total: 300 });
  });
});

describe("série quotidienne continue", () => {
  it("conserve 0 comme repos confirmé et null comme inconnu", () => {
    const series = buildContinuousDailyLoadSeries([
      { date: "2026-01-01", load: 200 },
      { date: "2026-01-03", load: 0 },
    ], "2026-01-01", "2026-01-03");
    expect(series).toEqual([
      { date: "2026-01-01", load: 200 },
      { date: "2026-01-02", load: null },
      { date: "2026-01-03", load: 0 },
    ]);
  });

  it("exclut une durée historique estimée des métriques quotidiennes", () => {
    const series = buildContinuousDailyLoadSeries([{ date: "2026-01-01", load: 300, estimated: true }]);
    expect(series[0].load).toBeNull();
  });

  it("coupe une analyse historique à la date demandée", () => {
    const weeklyCharge = [{
      athleteId: 7,
      week: 10,
      dailyLoads: [
        { date: "2026-03-04", load: 100 },
        { date: "2026-03-05", load: 200 },
        { date: "2026-03-06", load: 900 },
      ],
    }];
    const series = extractDailyLoads(7, weeklyCharge, 10, "2026-03-05");
    expect(series.at(-1)).toEqual({ date: "2026-03-05", load: 200 });
    expect(series.some(point => point.date === "2026-03-06")).toBe(false);
  });
});

describe("EWMA quotidienne et ACWR expérimental", () => {
  it("ne fabrique pas un ratio parfait sans données", () => {
    const result = computeEWMA([]);
    expect(result.acute).toBeNull();
    expect(result.chronic).toBeNull();
    expect(result.acwr).toBeNull();
    expect(result.status).toBe("insufficient_data");
  });

  it("attend 28 observations quotidiennes continues avant le ratio", () => {
    expect(computeEWMA(dailySeries(27)).acwr).toBeNull();
    const result = computeEWMA(dailySeries(28, index => 50 + index * 5));
    expect(result.acwr).toBeGreaterThan(1);
    expect(result.status).toBe("experimental");
  });

  it("un jour inconnu casse la continuité", () => {
    const series = dailySeries(35);
    series[10].load = null;
    const result = computeEWMA(series);
    expect(result.observedDays).toBe(24);
    expect(result.acwr).toBeNull();
  });
});

describe("fenêtres 7/28 jours", () => {
  it("retourne null si un jour est inconnu", () => {
    const series = dailySeries(28);
    series[25].load = null;
    expect(computeLoadWindows(series).load7).toBeNull();
    expect(computeLoadWindows(series).load28).toBeNull();
  });

  it("calcule séparément les deux sommes et leur variation", () => {
    const result = computeLoadWindows(dailySeries(28, index => index < 21 ? 100 : 200));
    expect(result.load7).toBe(1400);
    expect(result.load28).toBe(3500);
    expect(result.variationPercent).toBe(100);
  });
});

describe("monotonie sur sept charges quotidiennes", () => {
  it("requiert exactement sept jours connus", () => {
    expect(computeMonotonyAndStrain([100, 200, 300]).status).toBe("insufficient_data");
  });

  it("signale explicitement un écart-type nul", () => {
    const result = computeMonotonyAndStrain([100, 100, 100, 100, 100, 100, 100]);
    expect(result.monotony).toBeNull();
    expect(result.status).toBe("undefined_zero_variance");
  });

  it("calcule monotonie et contrainte sur une semaine variable", () => {
    const result = computeMonotonyAndStrain([0, 100, 200, 0, 300, 100, 0]);
    expect(result.monotony).toBeGreaterThan(0);
    expect(result.strain).toBeGreaterThan(0);
    expect(result.status).toBe("available");
  });
});

describe("AthleteOS Wellness Questionnaire v1", () => {
  it("normalise réellement toute l'échelle sur 0–100", () => {
    expect(computeWellnessScore({ sleep: 5, energy: 5, soreness: 1, mood: 5, stress: 1 })).toBe(100);
    expect(computeWellnessScore({ sleep: 1, energy: 1, soreness: 5, mood: 1, stress: 5 })).toBe(0);
  });

  it("refuse un questionnaire incomplet", () => {
    expect(computeWellnessScore({ sleep: 5, energy: null, soreness: 1, mood: 5, stress: 1 })).toBeNull();
  });
});

describe("règle d'espacement de programmation", () => {
  const now = new Date("2026-07-29T12:00:00");
  const session = {
    id: 1, category: "sprint", sessionDate: "2026-07-28", time: "10:00",
    validations: [{ athleteId: 1, status: "done", rpe: 8, actualDurationMinutes: 60 }],
  };

  it("utilise l'heure et la durée réelles de fin de séance", () => {
    const result = estimateRecovery([session], 1, null, now);
    expect(result.kind).toBe("programming_rule");
    expect(result.rangeHoursMin).toBe(23);
    expect(result.rangeHoursMax).toBe(71);
  });

  it("le wellness ne modifie pas arbitrairement la règle", () => {
    const bad = estimateRecovery([session], 1, { sleep: 1 }, now);
    const good = estimateRecovery([session], 1, { sleep: 5 }, now);
    expect(bad.rangeHoursMin).toBe(good.rangeHoursMin);
    expect(bad.rangeHoursMax).toBe(good.rangeHoursMax);
  });

  it("reste indisponible sans date, heure ou durée réelles", () => {
    const incomplete = { ...session, time: null };
    expect(estimateRecovery([incomplete], 1, null, now).status).toBe("insufficient_data");
  });

  it("compte aussi une séance 'partial' comme fin de séance connue", () => {
    const partial = { ...session, validations: [{ athleteId: 1, status: "partial", rpe: 6, actualDurationMinutes: 30 }] };
    const result = estimateRecovery([partial], 1, null, now);
    expect(result.status).not.toBe("insufficient_data");
    expect(result.lastSession.validation.status).toBe("partial");
  });

  it("retient la dernière séance quand plusieurs sont terminées", () => {
    const older = { ...session, id: 2, sessionDate: "2026-07-26", category: "endurance" };
    const result = estimateRecovery([older, session], 1, null, now);
    expect(result.lastSession.id).toBe(session.id);
  });

  it("signale window_elapsed une fois la fenêtre de repli technique dépassée", () => {
    const long = { ...session, category: "technique" };
    const late = new Date("2026-08-01T12:00:00");
    expect(estimateRecovery([long], 1, null, late).status).toBe("window_elapsed");
  });

  it("signale spacing_transition à l'intérieur de la fenêtre haute mais après la fenêtre basse", () => {
    const long = { ...session, category: "sprint" }; // règle 48-96h
    const between = new Date("2026-07-30T12:00:00"); // ~50h après la fin
    const result = estimateRecovery([long], 1, null, between);
    expect(result.status).toBe("spacing_transition");
  });

  it("retombe sur la règle 'technique' pour une catégorie non répertoriée", () => {
    const unknownCategory = { ...session, category: "inexistante" };
    const result = estimateRecovery([unknownCategory], 1, null, now);
    expect(result.factors[0].label).toContain("Règle inexistante configurée");
  });

  it("retombe sur 24-48h si même la règle 'technique' est absente du barème fourni", () => {
    const unknownCategory = { ...session, category: "inexistante" };
    const result = estimateRecovery([unknownCategory], 1, null, now, {});
    expect(result.rangeHoursMin).toBe(0);
    expect(result.rangeHoursMax).toBe(23);
  });

  it("nomme la règle « générale » quand la séance n'a pas de catégorie", () => {
    const noCategory = { ...session, category: null };
    const result = estimateRecovery([noCategory], 1, null, now);
    expect(result.factors[0].label).toContain("Règle générale configurée");
  });

  it("ignore une séance dont la date ne peut pas être interprétée", () => {
    const garbageDate = { ...session, sessionDate: "not-a-date" };
    expect(estimateRecovery([garbageDate], 1, null, now).status).toBe("insufficient_data");
  });
});

describe("libellé RPE", () => {
  it.each([[0, "Repos"], [10, "Maximum"], [null, "Non renseigné"]])("RPE %s", (rpe, label) => {
    expect(getRPELabel(rpe).label).toBe(label);
  });
});
