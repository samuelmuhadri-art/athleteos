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

  it("retombe sur les poids « technique » pour une catégorie inconnue", () => {
    const loads = computeSessionAxisLoads(60, 7, "categorie-inexistante");
    expect(loads).toEqual(computeSessionAxisLoads(60, 7, "technique"));
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

  it("ne calcule pas de rythme habituel sans semaine antérieure", () => {
    const single = [session(1, 10, "sprint", 60, 7)];
    const profile = getAthleteAxisProfile(1, single, 10);
    expect(profile.neuromuscular.habitualLoad).toBeNull();
    expect(profile.neuromuscular.variationPercent).toBeNull();
  });

  it("passe de « faible » à « modérée » puis « élevée » selon le nombre de semaines connues", () => {
    const fiveWeeks = [1, 2, 3, 4, 5].map(week => session(week, week, "sprint", 40, 6));
    expect(getAthleteAxisProfile(1, fiveWeeks, 5).neuromuscular.dataQuality).toBe("modérée");

    const eightWeeks = [1, 2, 3, 4, 5, 6, 7, 8].map(week => session(week, week, "sprint", 40, 6));
    expect(getAthleteAxisProfile(1, eightWeeks, 8).neuromuscular.dataQuality).toBe("élevée");
  });
});

describe("contributeurs", () => {
  it("classe la séance la plus contributrice en premier", () => {
    const sessions = [session(1, 10, "sprint", 30, 5), session(2, 10, "sprint", 90, 9), session(3, 10, "mobilite", 60, 3)];
    expect(getAxisTopContributors(1, sessions, "neuromuscular", 10)[0].id).toBe(2);
  });

  it("ignore les séances hors de la fenêtre des deux dernières semaines", () => {
    const sessions = [session(1, 8, "sprint", 60, 9), session(2, 10, "sprint", 60, 9)];
    const ids = getAxisTopContributors(1, sessions, "neuromuscular", 10).map(item => item.id);
    expect(ids).toEqual([2]);
  });

  it("ignore une séance sans charge exploitable pour l'axe demandé", () => {
    const invalid = session(1, 10, "sprint", 60, null);
    const valid = session(2, 10, "sprint", 60, 8);
    const ids = getAxisTopContributors(1, [invalid, valid], "neuromuscular", 10).map(item => item.id);
    expect(ids).toEqual([2]);
  });
});
