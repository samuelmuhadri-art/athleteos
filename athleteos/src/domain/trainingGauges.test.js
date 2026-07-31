import { describe, expect, it } from "vitest";
import { getTrainingGaugeReading } from "./trainingGauges";

function dayStr(offset) {
  const d = new Date("2026-01-01T00:00:00Z");
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function buildEwmaHistory(days, chronicAt) {
  return Array.from({ length: days }, (_, i) => ({
    date: dayStr(i), load: 100, acute: 100, chronic: chronicAt(i),
  }));
}

describe("getTrainingGaugeReading > weeklyLoad", () => {
  it("signale « Bon » quand la charge est proche de l'habitude", () => {
    const reading = getTrainingGaugeReading("weeklyLoad", { metrics: { variationPercent: 5, load7: 400, load28: 1500 } });
    expect(reading.statusWord).toBe("Bon");
    expect(reading.color).toBe("var(--tone-success)");
    expect(reading.available).toBe(true);
  });

  it("signale les deux extrêmes (très élevé ET très faible) comme des points d'attention", () => {
    const high = getTrainingGaugeReading("weeklyLoad", { metrics: { variationPercent: 40 } });
    const low = getTrainingGaugeReading("weeklyLoad", { metrics: { variationPercent: -40 } });
    expect(high.statusWord).toBe("Très élevé");
    expect(high.color).toBe("var(--tone-danger)");
    expect(low.statusWord).toBe("Faible");
    expect(low.color).toBe("var(--tone-danger)");
  });

  it("reste disponible=false sans assez de données", () => {
    const reading = getTrainingGaugeReading("weeklyLoad", { metrics: { variationPercent: null } });
    expect(reading.available).toBe(false);
    expect(reading.statusWord).toBeNull();
    expect(reading.missingReason).toBeTruthy();
  });
});

describe("getTrainingGaugeReading > form", () => {
  it("reprend le score/couleur du daily state tel quel", () => {
    const reading = getTrainingGaugeReading("form", {
      dailyState: { score: 82, color: "var(--tone-success)", plainSummary: "Ça va bien aujourd'hui." },
    });
    expect(reading.statusWord).toBe("Élevé");
    expect(reading.color).toBe("var(--tone-success)");
    expect(reading.interpretation).toBe("Ça va bien aujourd'hui.");
  });

  it("indique l'absence de réponse plutôt qu'un zéro", () => {
    const reading = getTrainingGaugeReading("form", { dailyState: { score: null } });
    expect(reading.available).toBe(false);
    expect(reading.statusWord).toBeNull();
  });
});

describe("getTrainingGaugeReading > fitness", () => {
  it("détecte une progression sur 28 jours à partir de ewmaHistory", () => {
    const history = buildEwmaHistory(29, (i) => (i === 0 ? 100 : i === 28 ? 115 : 105));
    const reading = getTrainingGaugeReading("fitness", { metrics: { chronic: 115, ewmaHistory: history } });
    expect(reading.statusWord).toBe("Élevé");
    expect(reading.color).toBe("var(--tone-success)");
  });

  it("reste indisponible sans assez d'historique continu", () => {
    const history = buildEwmaHistory(5, () => 100);
    const reading = getTrainingGaugeReading("fitness", { metrics: { chronic: 100, ewmaHistory: history } });
    expect(reading.available).toBe(false);
  });
});

describe("getTrainingGaugeReading > readiness", () => {
  it("est basse pendant la fenêtre d'espacement active avec un ressenti moyen", () => {
    const reading = getTrainingGaugeReading("readiness", {
      metrics: { recovery: { status: "spacing_active", rangeHoursMin: 10, rangeHoursMax: 20 }, wellnessScore: 40 },
    });
    expect(reading.statusWord).toBe("Faible");
  });

  it("est très élevée fenêtre terminée + bon ressenti", () => {
    const reading = getTrainingGaugeReading("readiness", {
      metrics: { recovery: { status: "window_elapsed" }, wellnessScore: 80 },
    });
    expect(reading.statusWord).toBe("Très élevé");
  });

  it("reste indisponible sans séance récente exploitable", () => {
    const reading = getTrainingGaugeReading("readiness", { metrics: { recovery: { status: "insufficient_data" } } });
    expect(reading.available).toBe(false);
  });
});

describe("getTrainingGaugeReading > fatigue", () => {
  it("signale une sollicitation très élevée à partir de l'ACWR", () => {
    const reading = getTrainingGaugeReading("fatigue", { metrics: { acwr: 1.3 } });
    expect(reading.statusWord).toBe("Très élevé");
    expect(reading.color).toBe("var(--tone-danger)");
  });

  it("reste neutre autour d'un ratio de 1", () => {
    const reading = getTrainingGaugeReading("fatigue", { metrics: { acwr: 1.0 } });
    expect(reading.statusWord).toBe("Bon");
    expect(reading.color).toBe("var(--tone-success)");
  });

  it("reste indisponible sans ratio calculable", () => {
    const reading = getTrainingGaugeReading("fatigue", { metrics: { acwr: null } });
    expect(reading.available).toBe(false);
  });

  it("mentionne l'axe dominant de la semaine quand des séances sont fournies", () => {
    const sessions = [{
      id: 1, week: 10, athleteIds: [7], category: "sprint", trainingFocus: "sprint_general",
      validations: [{ athleteId: 7, actualDurationMinutes: 60, rpe: 8 }],
    }];
    const reading = getTrainingGaugeReading("fatigue", {
      metrics: { acwr: 1.3 }, sessions, athleteId: 7, currentWeek: 10,
    });
    expect(reading.interpretation).toMatch(/sollicité/);
  });
});
