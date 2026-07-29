import { describe, expect, it } from "vitest";
import { getDefaultTrainingFocus, getSessionTrainingFocus, getTrainingFocus, getTrainingFocusOptions, isTrainingFocusCompatible } from "./trainingFocus";

describe("objectifs de séance d'athlétisme", () => {
  it("couvre les intentions qui ne peuvent pas être déduites de la distance", () => {
    expect(getTrainingFocusOptions("sprint").map(item => item.id)).toEqual(expect.arrayContaining(["acceleration", "max_velocity", "speed_endurance", "special_endurance"]));
    expect(getTrainingFocusOptions("endurance").map(item => item.id)).toEqual(expect.arrayContaining(["easy_run", "vma_vo2", "race_pace"]));
    expect(getTrainingFocusOptions("saut").map(item => item.id)).toEqual(expect.arrayContaining(["plyometrics", "bounds", "jump_technical"]));
  });

  it("reste compatible avec les anciennes séances sans objectif détaillé", () => {
    expect(getSessionTrainingFocus({ category: "sprint" }).id).toBe("sprint_general");
    expect(getSessionTrainingFocus({ category: "endurance" }).id).toBe("endurance_general");
  });

  it("retombe sur un objectif générique si une valeur appartient à une autre catégorie", () => {
    expect(isTrainingFocusCompatible("vma_vo2", "sprint")).toBe(false);
    expect(getTrainingFocus("unknown", "saut").id).toBe(getDefaultTrainingFocus("saut"));
  });
});
