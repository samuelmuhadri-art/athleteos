import { describe, expect, it } from "vitest";
import { configuredWellnessQuestions, DEFAULT_WELLNESS_QUESTIONNAIRE, initialWellnessAnswers, legacyWellnessValues, normalizeWellnessQuestionnaire, requiredWellnessComplete, wellnessQuestionnaireRequestedOn } from "./wellnessQuestionnaire";

describe("questionnaire wellness configurable", () => {
  it("conserve le questionnaire historique comme défaut", () => {
    expect(configuredWellnessQuestions(null).map(item => item.key)).toEqual(["sleep","energy","soreness","mood","stress"]);
    expect(DEFAULT_WELLNESS_QUESTIONNAIRE.questions.every(item => item.required)).toBe(true);
  });

  it("ignore les clés inconnues, déduplique et conserve l'ordre du coach", () => {
    const result = normalizeWellnessQuestionnaire({ questions:[{ key:"motivation", required:false },{ key:"sleep", required:true },{ key:"sleep", required:false },{ key:"custom", required:true }], activeDays:[5,1,5], responseVisibility:"head_coach" });
    expect(result.questions).toEqual([{ key:"motivation", required:false },{ key:"sleep", required:true }]);
    expect(result.activeDays).toEqual([1,5]);
    expect(result.responseVisibility).toBe("head_coach");
  });

  it("distingue les questions obligatoires et conserve les colonnes historiques", () => {
    const config = { questions:[{ key:"sleep", required:true },{ key:"motivation", required:false }] };
    expect(requiredWellnessComplete(config, { sleep:4, motivation:null })).toBe(true);
    expect(requiredWellnessComplete(config, { sleep:null, motivation:5 })).toBe(false);
    expect(legacyWellnessValues({ sleep:4, motivation:5 })).toEqual({ sleep:4, energy:null, soreness:null, mood:null, stress:null });
    expect(initialWellnessAnswers(config, { sleep:3, answers:{ motivation:4 } })).toEqual({ sleep:3, motivation:4 });
  });

  it("respecte les jours configurés", () => {
    const monday = new Date("2026-09-07T10:00:00");
    expect(wellnessQuestionnaireRequestedOn({ questions:[{ key:"sleep" }], activeDays:[1,3,5] }, monday)).toBe(true);
    expect(wellnessQuestionnaireRequestedOn({ questions:[{ key:"sleep" }], activeDays:[2,4] }, monday)).toBe(false);
  });
});
