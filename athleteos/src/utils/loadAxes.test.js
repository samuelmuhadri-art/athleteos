import { describe, it, expect } from "vitest";
import {
  LOAD_AXES, AXIS_WEIGHTS, computeSessionAxisLoads, getAthleteAxisProfile, getAxisTopContributors,
} from "./loadAxes.js";

const AXIS_IDS = Object.keys(LOAD_AXES);

function session(id, week, category, actualDurationMinutes, rpe, athleteId = 1, trainingFocus = null) {
  return {
    id, week, category, trainingFocus, athleteIds: [athleteId],
    validations: [{ athleteId, rpe, actualDurationMinutes, durationSource: "reported" }],
  };
}

describe("dimensions de contrainte", () => {
  it("définit tous les poids dans [0,1]", () => {
    Object.values(AXIS_WEIGHTS).forEach(weights => AXIS_IDS.forEach(axis => {
      expect(weights[axis]).toBeGreaterThanOrEqual(0);
      expect(weights[axis]).toBeLessThanOrEqual(1);
    }));
  });

  it("ventile la charge standard sans la diviser par dix", () => {
    const loads = computeSessionAxisLoads(60, 7, "sprint");
    expect(loads.neuromuscular).toBe(420);
    expect(loads.metabolic).toBe(126);
  });

  it("refuse une durée réelle absente", () => {
    expect(computeSessionAxisLoads(null, 7, "sprint")).toBeNull();
  });

  it("distingue l'objectif sans changer la formule globale durée × RPE", () => {
    const resistance = computeSessionAxisLoads(60, 7, "sprint", "special_endurance");
    const acceleration = computeSessionAxisLoads(60, 7, "sprint", "acceleration");
    expect(resistance.metabolic).toBeGreaterThan(acceleration.metabolic);
    expect(acceleration.neuromuscular).toBeGreaterThan(resistance.neuromuscular);
    expect(60 * 7).toBe(420);
  });

  it("sépare un 3 × 300 VMA d'un 3 × 300 en résistance sprint", () => {
    const vma = computeSessionAxisLoads(45, 8, "endurance", "vma_vo2");
    const resistance = computeSessionAxisLoads(45, 8, "sprint", "special_endurance");
    expect(vma.metabolic).toBe(resistance.metabolic);
    expect(resistance.neuromuscular).toBeGreaterThan(vma.neuromuscular);
  });

  it("sépare la pliométrie de la technique de saut", () => {
    const plyometrics = computeSessionAxisLoads(30, 6, "saut", "plyometrics");
    const technique = computeSessionAxisLoads(30, 6, "saut", "jump_technical");
    expect(plyometrics.elastic).toBeGreaterThan(technique.elastic);
    expect(technique.technical).toBeGreaterThan(plyometrics.technical);
  });
});

describe("profil descriptif", () => {
  const sessions = [
    session(1, 8, "sprint", 60, 7), session(2, 8, "force", 45, 8),
    session(3, 9, "sprint", 60, 6), session(4, 9, "endurance", 50, 5),
    session(5, 10, "sprint", 70, 8), session(6, 10, "force", 40, 7),
  ];

  it("est reproductible et ne publie aucun ACWR par axe", () => {
    const first = getAthleteAxisProfile(1, sessions, 10);
    const second = getAthleteAxisProfile(1, sessions, 10);
    AXIS_IDS.forEach(axis => {
      expect(first[axis].score).toBe(second[axis].score);
      expect(first[axis].acwr).toBeUndefined();
    });
  });

  it("compare la dernière semaine à une moyenne précédente", () => {
    const profile = getAthleteAxisProfile(1, sessions, 10);
    expect(profile.neuromuscular.currentLoad).toBeGreaterThan(0);
    expect(profile.neuromuscular.habitualLoad).toBeGreaterThan(0);
    expect(profile.neuromuscular.dataQuality).toBe("faible");
  });

  it("respecte la semaine de coupure historique", () => {
    const before = getAthleteAxisProfile(1, sessions, 9);
    expect(before.neuromuscular.currentWeek).toBe(9);
  });
});

describe("contributeurs", () => {
  it("classe la séance la plus contributrice en premier", () => {
    const sessions = [session(1, 10, "sprint", 30, 5), session(2, 10, "sprint", 90, 9), session(3, 10, "mobilite", 60, 3)];
    expect(getAxisTopContributors(1, sessions, "neuromuscular", 10)[0].id).toBe(2);
  });
});
