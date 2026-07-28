// ============================================================
// AthleteOS — src/utils/trainingLoad.test.js
//
// Fonctions pures de calcul de charge (méthode session-RPE, tâche 16),
// EWMA/monotonie/contrainte, score wellness (Hooper Index) et
// estimateRecovery() (tâche 17). estimateRecovery est portée depuis
// test_recovery_estimate.mjs ; les autres fonctions n'avaient encore
// aucun test (tâche 19) — golden datasets vérifiés par calcul réel du
// module avant écriture (jamais de valeur attendue devinée à la main).
// ============================================================

import { describe, it, expect } from "vitest";
import {
  computeSessionLoad, computeWellnessScore, computeEWMA, computeMonotonyAndStrain,
  getRPELabel, estimateRecovery, RECOVERY_HOURS_RANGE,
} from "./trainingLoad.js";

describe("computeSessionLoad — golden dataset", () => {
  it("60min RPE7 sprint (coef 1.1) -> 46", () => {
    expect(computeSessionLoad(60, 7, "sprint")).toBe(46);
  });

  it("45min RPE8 force (coef 1.3) -> 47", () => {
    expect(computeSessionLoad(45, 8, "force")).toBe(47);
  });

  it("catégorie inconnue -> coefficient par défaut 1.0", () => {
    expect(computeSessionLoad(60, 5, "unknown_category")).toBe(30);
  });

  it("durée ou RPE manquant -> null (jamais une charge inventée)", () => {
    expect(computeSessionLoad(null, 5, "sprint")).toBeNull();
    expect(computeSessionLoad(60, null, "sprint")).toBeNull();
  });
});

describe("computeWellnessScore — Hooper Index (soreness/stress inversés)", () => {
  it("toutes les réponses au mieux -> 100", () => {
    expect(computeWellnessScore({ sleep: 5, energy: 5, soreness: 1, mood: 5, stress: 1 })).toBe(100);
  });

  it("toutes les réponses au pire -> 20 (jamais 0, l'échelle part de 1)", () => {
    expect(computeWellnessScore({ sleep: 1, energy: 1, soreness: 5, mood: 1, stress: 5 })).toBe(20);
  });

  it("un champ manquant -> null, jamais un score partiel trompeur", () => {
    expect(computeWellnessScore({ sleep: 5, energy: null, soreness: 1, mood: 5, stress: 1 })).toBeNull();
  });

  it("wellness absent -> null", () => {
    expect(computeWellnessScore(null)).toBeNull();
  });
});

describe("computeEWMA — charge aiguë/chronique et ACWR", () => {
  it("aucune donnée -> zéros, ACWR neutre à 1.0", () => {
    expect(computeEWMA([])).toEqual({ acute: 0, chronic: 0, acwr: 1, ewmaHistory: [] });
  });

  it("un seul jour -> acute = chronic = charge du jour, ACWR = 1", () => {
    const r = computeEWMA([{ date: "2026-01-01", load: 100 }]);
    expect(r.acute).toBe(100);
    expect(r.chronic).toBe(100);
    expect(r.acwr).toBe(1);
  });

  it("charge croissante -> ACWR > 1 (charge aiguë monte plus vite que la chronique)", () => {
    const rising = [{ date: "d1", load: 50 }, { date: "d2", load: 100 }, { date: "d3", load: 150 }, { date: "d4", load: 200 }];
    const r = computeEWMA(rising);
    expect(r.acute).toBe(113);
    expect(r.chronic).toBe(70);
    expect(r.acwr).toBe(1.62);
    expect(r.ewmaHistory).toHaveLength(4);
  });
});

describe("computeMonotonyAndStrain", () => {
  it("aucune donnée -> zéros", () => {
    expect(computeMonotonyAndStrain([])).toEqual({ monotony: 0, strain: 0 });
  });

  it("charge parfaitement constante -> monotonie 0 (écart-type nul, pas une division par zéro qui plante)", () => {
    expect(computeMonotonyAndStrain([100, 100, 100])).toEqual({ monotony: 0, strain: 0 });
  });

  it("charge variable -> golden dataset [100,200,300]", () => {
    expect(computeMonotonyAndStrain([100, 200, 300])).toEqual({ monotony: 2.45, strain: 1470 });
  });
});

describe("getRPELabel", () => {
  it.each([
    [0, "Repos"],
    [10, "Maximum"],
    [null, "Non renseigné"],
  ])("RPE %s -> %s", (rpe, label) => {
    expect(getRPELabel(rpe).label).toBe(label);
  });
});

describe("estimateRecovery — plage + confiance, jamais une fausse certitude", () => {
  function doneSession({ id, category, durationMinutes, rpe, daysAgo }) {
    const d = new Date(Date.now() - daysAgo * 86400000);
    const sessionDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { id, category, durationMinutes, sessionDate, validations: [{ athleteId: 1, status: "done", rpe }] };
  }

  const baseSession = doneSession({ id: 1, category: "sprint", durationMinutes: 60, rpe: 8, daysAgo: 1 });

  it("aucune séance -> insufficient_data, pas de fausse certitude", () => {
    const r = estimateRecovery([], 1, null, new Date());
    expect(r.status).toBe("insufficient_data");
    expect(r.rangeHoursMin).toBeNull();
    expect(r.rangeHoursMax).toBeNull();
  });

  it("séance seule, sans wellness -> statut valide, plage dans les bornes de la catégorie", () => {
    const r = estimateRecovery([baseSession], 1, null, new Date());
    expect(r.status).not.toBe("insufficient_data");
    expect(r.rangeHoursMin).toBeGreaterThanOrEqual(0);
    expect(r.rangeHoursMax).toBeLessThanOrEqual(RECOVERY_HOURS_RANGE.sprint.max);
  });

  it("wellness mauvais vs bon -> plages différentes, mauvais implique une récup plus longue", () => {
    const now = new Date();
    const wellnessBad  = { date: now.toISOString(), sleep: 1, energy: 1, soreness: 5, mood: 1, stress: 5 };
    const wellnessGood = { date: now.toISOString(), sleep: 5, energy: 5, soreness: 1, mood: 5, stress: 1 };
    const rBad  = estimateRecovery([baseSession], 1, wellnessBad, now);
    const rGood = estimateRecovery([baseSession], 1, wellnessGood, now);
    expect(rBad.rangeHoursMax >= rGood.rangeHoursMax).toBe(true);
    expect(rBad.factors.length).toBeGreaterThan(0);
  });

  it("wellness ancien (>36h) -> traité comme absent, aucun facteur sommeil/courbatures/stress ajouté", () => {
    const now = new Date();
    const oldWellness = { date: new Date(now.getTime() - 5 * 86400000).toISOString(), sleep: 1, energy: 1, soreness: 5, mood: 1, stress: 5 };
    const rOld = estimateRecovery([baseSession], 1, oldWellness, now);
    expect(rOld.factors.some((f) => /sommeil|courbature|stress/i.test(f.label))).toBe(false);
  });

  it("sans donnée subjective -> pas de crash, confiance <= avec wellness frais", () => {
    const now = new Date();
    const freshWellness = { date: now.toISOString(), sleep: 3, energy: 3, soreness: 3, mood: 3, stress: 3 };
    const rNone = estimateRecovery([baseSession], 1, null, now);
    const rWith = estimateRecovery([baseSession], 1, freshWellness, now);
    expect(rNone.status).not.toBeUndefined();
    expect(rNone.confidenceScore).toBeLessThanOrEqual(rWith.confidenceScore);
  });

  it("valeurs extrêmes -> bornes plafonnées, confiance dans [0,100], min <= max", () => {
    const now = new Date();
    const manyHardSessions = Array.from({ length: 6 }, (_, i) =>
      doneSession({ id: 100 + i, category: "sprint", durationMinutes: 120, rpe: 10, daysAgo: i })
    );
    const extremeWellness = { date: now.toISOString(), sleep: 1, energy: 1, soreness: 5, mood: 1, stress: 5 };
    const r = estimateRecovery(manyHardSessions, 1, extremeWellness, now);
    expect(r.rangeHoursMax).toBeLessThanOrEqual(RECOVERY_HOURS_RANGE.sprint.max);
    expect(r.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(r.confidenceScore).toBeLessThanOrEqual(100);
    expect(r.rangeHoursMin).toBeLessThanOrEqual(r.rangeHoursMax);
  });

  it("ne renvoie jamais une clé de blocage automatique (une estimation, pas un verdict interdit)", () => {
    const r = estimateRecovery([baseSession], 1, null, new Date());
    for (const key of ["blocked", "forbidden", "disallowed", "denied"]) {
      expect(key in r).toBe(false);
    }
  });
});
