// ============================================================
// AthleteOS — src/domain/disciplines.test.js
//
// Registre central des disciplines (tâche 9), porté ici en Vitest
// (tâche 19) depuis test_discipline_registry.mjs — fonctions pures,
// aucune base de données requise.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  DISCIPLINES, validateRegistry, resolveDisciplineId, getDiscipline,
  getDisciplineType, getDisciplineHib, getDisciplineUnit,
  getDisciplineDecimals, getDisciplineInputFormat, getDisciplineColor, getDisciplineSubEvents,
  getAllDisciplineIds, MEASUREMENT_TYPE, INPUT_FORMAT, PERFORMANCE_DIRECTION,
  createPerformanceMetadata, normalizePerformanceMetadata, validatePerformanceMetadata,
} from "./disciplines.js";
import { getDiscHib, getDiscType } from "../athlete/shared.js";
import { discColor, COMBINE_EVENTS } from "../athlete/views/perfsShared.js";

describe("registre — cohérence interne", () => {
  it("aucune collision d'ID/alias, aucun champ obligatoire manquant", () => {
    expect(validateRegistry()).toEqual([]);
  });
});

describe("couverture par famille de disciplines", () => {
  it("100m (sprint) : chrono, plus petit = mieux", () => {
    const d = getDiscipline("100m");
    expect(d.measurementType).toBe(MEASUREMENT_TYPE.TIME);
    expect(d.higherIsBetter).toBe(false);
  });

  it("1500m (demi-fond) : chrono min:s, plus petit = mieux", () => {
    const d = getDiscipline("1500m");
    expect(d.measurementType).toBe(MEASUREMENT_TYPE.TIME);
    expect(d.unit).toBe("s");
    expect(d.higherIsBetter).toBe(false);
  });

  it("Longueur (saut) : distance, plus grand = mieux", () => {
    const d = getDiscipline("Longueur");
    expect(d.measurementType).toBe(MEASUREMENT_TYPE.DISTANCE);
    expect(d.higherIsBetter).toBe(true);
  });

  it("Poids (lancer) : distance, plus grand = mieux", () => {
    const d = getDiscipline("Poids");
    expect(d.measurementType).toBe(MEASUREMENT_TYPE.DISTANCE);
    expect(d.higherIsBetter).toBe(true);
  });

  it("Décathlon (combinée) : points, plus grand = mieux, 10 sous-épreuves", () => {
    const d = getDiscipline("Décathlon");
    expect(d.measurementType).toBe(MEASUREMENT_TYPE.POINTS);
    expect(d.higherIsBetter).toBe(true);
    expect(d.subEvents).toHaveLength(10);
  });

  it("Heptathlon (combinée) : points, plus grand = mieux, 7 sous-épreuves", () => {
    const d = getDiscipline("Heptathlon");
    expect(d.subEvents).toHaveLength(7);
  });

  it("au moins une discipline par famille", () => {
    for (const type of ["sprint", "endurance", "saut", "lancer", "combine"]) {
      expect(Object.values(DISCIPLINES).some((d) => d.type === type)).toBe(true);
    }
  });
});

describe("resolveDisciplineId — alias historiques normalisés", () => {
  it.each([
    ["100 m", "100m"],
    ["100M", "100m"],
    ["  100m  ", "100m"],
    ["Saut en longueur", "Longueur"],
    ["Lancer de poids", "Poids"],
  ])("%s -> %s", (input, expected) => {
    expect(resolveDisciplineId(input)).toBe(expected);
  });

  it("getDiscHib résout un alias comme le nom canonique", () => {
    expect(getDisciplineHib("100 m")).toBe(getDisciplineHib("100m"));
  });

  it("null -> null, sans planter", () => {
    expect(resolveDisciplineId(null)).toBeNull();
  });

  it("chaîne vide -> chaîne vide, sans planter", () => {
    expect(resolveDisciplineId("")).toBe("");
  });
});

describe("discipline inconnue / personnalisée — jamais de crash", () => {
  it("valeurs de secours cohérentes, aucune exception", () => {
    const name = "Épreuve Maison Inventée";
    expect(() => {
      const fallback = {
        type: getDisciplineType(name), hib: getDisciplineHib(name),
        unit: getDisciplineUnit(name), color: getDisciplineColor(name),
        subEvents: getDisciplineSubEvents(name),
      };
      expect(fallback.type).not.toBeNull();
      expect(fallback.hib).toBeNull();
      expect(fallback.unit).toBeNull();
      expect(fallback.color).not.toBeNull();
      expect(fallback.subEvents).toBeNull();
    }).not.toThrow();
  });

  it("resolveDisciplineId renvoie le texte tel quel (trim uniquement)", () => {
    expect(resolveDisciplineId("  Épreuve Maison Inventée  ")).toBe("Épreuve Maison Inventée");
  });

  it("ne suppose jamais qu'une valeur décimale libre est un chrono", () => {
    const metadata = createPerformanceMetadata("Test club");
    expect(metadata.measurement_type).toBe(MEASUREMENT_TYPE.UNKNOWN);
    expect(metadata.performance_direction).toBe(PERFORMANCE_DIRECTION.UNKNOWN);
    expect(validatePerformanceMetadata("Test club", metadata)).toHaveLength(3);
  });

  it("accepte une épreuve libre lorsque unité et sens sont explicites", () => {
    const metadata = normalizePerformanceMetadata("Test club", {
      unit: "m", measurement_type: "distance", performance_direction: "higher",
    });
    expect(validatePerformanceMetadata("Test club", metadata)).toEqual([]);
  });
});

describe("métadonnées techniques structurées", () => {
  it("décrit le vent et le chronométrage du 100m", () => {
    const discipline = getDiscipline("100m");
    expect(discipline.windMeasurement).toBe("required_for_official_review");
    expect(discipline.timingMethods).toContain("fully_automatic");
  });

  it("demande le poids d'engin pour les lancers et la hauteur pour les haies", () => {
    expect(getDiscipline("Poids").requiresImplementWeight).toBe(true);
    expect(getDiscipline("110m haies").requiresHurdleHeight).toBe(true);
  });

  it("versionne séparément les tables des combinées", () => {
    expect(getDiscipline("Décathlon").scoringTableVersion).toBe("IAAF_COMBINED_EVENTS_2012");
  });
});

describe("formats attendus", () => {
  it("100m -> inputFormat seconds, 2 décimales", () => {
    expect(getDisciplineInputFormat("100m")).toBe(INPUT_FORMAT.SECONDS);
    expect(getDisciplineDecimals("100m")).toBe(2);
  });

  it("1500m -> inputFormat minutes", () => {
    expect(getDisciplineInputFormat("1500m")).toBe(INPUT_FORMAT.MINUTES);
  });

  it("Longueur -> inputFormat meters", () => {
    expect(getDisciplineInputFormat("Longueur")).toBe(INPUT_FORMAT.METERS);
  });

  it("Décathlon -> inputFormat points", () => {
    expect(getDisciplineInputFormat("Décathlon")).toBe(INPUT_FORMAT.POINTS);
  });

  it("au moins 19 disciplines connues", () => {
    expect(getAllDisciplineIds().length).toBeGreaterThanOrEqual(19);
  });
});

describe("compat — les façades existantes délèguent au même registre (pas de duplication divergente)", () => {
  it("athlete/shared.js getDiscHib délègue au registre", () => {
    expect(getDiscHib("100m")).toBe(getDisciplineHib("100m"));
  });

  it("athlete/shared.js getDiscType délègue au registre", () => {
    expect(getDiscType("Poids")).toBe(getDisciplineType("Poids"));
  });

  it("perfsShared.js discColor délègue au registre", () => {
    expect(discColor("100m")).toBe(getDisciplineColor("100m"));
  });

  it("perfsShared.js COMBINE_EVENTS === registre", () => {
    expect(COMBINE_EVENTS["Décathlon"]).toEqual(getDisciplineSubEvents("Décathlon"));
  });
});
