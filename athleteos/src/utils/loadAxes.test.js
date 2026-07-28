// ============================================================
// AthleteOS — src/utils/loadAxes.test.js
//
// Profil de charge à 6 axes (tâche 18), porté ici en Vitest (tâche 19)
// depuis test_axis_profile.mjs — fonctions pures, aucune base de
// données requise.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  LOAD_AXES, AXIS_WEIGHTS, computeSessionAxisLoads, getAthleteAxisProfile, getAxisTopContributors,
} from "./loadAxes.js";

const AXIS_IDS = Object.keys(LOAD_AXES);

function session(id, week, category, durationMinutes, rpe, athleteId = 1) {
  return {
    id, week, category, durationMinutes, athleteIds: [athleteId],
    validations: [{ athleteId, rpe }],
  };
}

describe("AXIS_WEIGHTS — bornes et complétude", () => {
  it("chaque poids catégorie->axe est dans [0,1]", () => {
    for (const [cat, weights] of Object.entries(AXIS_WEIGHTS)) {
      for (const axis of AXIS_IDS) {
        const w = weights[axis];
        expect(typeof w, `${cat}.${axis}`).toBe("number");
        expect(w, `${cat}.${axis}`).toBeGreaterThanOrEqual(0);
        expect(w, `${cat}.${axis}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("chaque catégorie a un poids défini pour les 6 axes (pas de trou silencieux)", () => {
    for (const [, weights] of Object.entries(AXIS_WEIGHTS)) {
      for (const axis of AXIS_IDS) {
        expect(typeof weights[axis]).toBe("number");
      }
    }
  });
});

describe("computeSessionAxisLoads — golden dataset", () => {
  it("sprint 60min RPE7 -> axe nerveux = 42, axe métabolique = 13", () => {
    const loads = computeSessionAxisLoads(60, 7, "sprint");
    expect(loads.neuromuscular).toBe(42);
    expect(loads.metabolic).toBe(13);
  });
});

describe("getAthleteAxisProfile — baseline insuffisante", () => {
  it("1 seule semaine de données -> profil null (pas de score inventé)", () => {
    const oneWeek = [session(1, 10, "sprint", 60, 7)];
    expect(getAthleteAxisProfile(1, oneWeek, 10)).toBeNull();
  });

  it("aucune séance -> profil null", () => {
    expect(getAthleteAxisProfile(1, [], 10)).toBeNull();
  });
});

describe("getAthleteAxisProfile — reproductibilité et qualité de données", () => {
  const sessions = [
    session(1, 8, "sprint", 60, 7), session(2, 8, "force", 45, 8),
    session(3, 9, "sprint", 60, 6), session(4, 9, "endurance", 50, 5),
    session(5, 10, "sprint", 70, 8), session(6, 10, "force", 40, 7),
  ];

  it("mêmes séances -> exactement le même score (reproductible)", () => {
    const profile1 = getAthleteAxisProfile(1, sessions, 10);
    const profile2 = getAthleteAxisProfile(1, sessions, 10);
    for (const axis of AXIS_IDS) {
      expect(profile1[axis].score).toBe(profile2[axis].score);
      expect(profile1[axis].acwr).toBe(profile2[axis].acwr);
    }
  });

  it("3 semaines de données -> qualité 'faible'", () => {
    const profile = getAthleteAxisProfile(1, sessions, 10);
    expect(profile.neuromuscular.dataQuality).toBe("faible");
  });

  it("9 semaines de données -> qualité 'élevée'", () => {
    const manyWeeks = Array.from({ length: 9 }, (_, i) => session(100 + i, i + 1, "sprint", 60, 7));
    const profile = getAthleteAxisProfile(1, manyWeeks, 9);
    expect(profile.neuromuscular.dataQuality).toBe("élevée");
  });

  it("expose acute ET chronic (comparaison à la baseline, pas juste un ratio)", () => {
    const profile = getAthleteAxisProfile(1, sessions, 10);
    expect(typeof profile.neuromuscular.acute).toBe("number");
    expect(typeof profile.neuromuscular.chronic).toBe("number");
  });
});

describe("getAxisTopContributors", () => {
  it("la séance la plus dure sur un axe ressort en premier", () => {
    const currentWeek = 10;
    const sessions = [
      session(1, currentWeek, "sprint", 30, 5),
      session(2, currentWeek, "sprint", 90, 9),
      session(3, currentWeek, "mobilite", 60, 3),
    ];
    const top = getAxisTopContributors(1, sessions, "neuromuscular", currentWeek);
    expect(top.length).toBeGreaterThan(0);
    expect(top[0].id).toBe(2);
  });
});
