import { describe, expect, it } from "vitest";
import {
  buildDuplicateForm,
  generateRecurrenceDates,
  groupAthletes,
  mergeTargetSelection,
} from "./planningEvolution";

describe("récurrence planning", () => {
  it("génère une occurrence chaque mardi sans déplacer les dates civiles", () => {
    expect(generateRecurrenceDates({
      startsOn: "2026-09-15", endsOn: "2026-10-06", intervalWeeks: 1, weekdays: [2],
    })).toEqual(["2026-09-15", "2026-09-22", "2026-09-29", "2026-10-06"]);
  });

  it("gère deux jours, une semaine sur deux et une limite de répétitions", () => {
    expect(generateRecurrenceDates({
      startsOn: "2026-09-14", occurrenceCount: 4, intervalWeeks: 2, weekdays: [1, 4],
    })).toEqual(["2026-09-14", "2026-09-17", "2026-09-28", "2026-10-01"]);
  });

  it("refuse une règle incomplète", () => {
    expect(generateRecurrenceDates({ startsOn: "2026-09-15", weekdays: [2] })).toEqual([]);
  });
});

describe("cibles et duplication", () => {
  it("sélectionne un groupe en une opération", () => {
    const groups = groupAthletes([
      { id: 1, group: "Sprint" }, { id: 2, groupName: "Sprint" }, { id: 3, group: "Perche" },
    ]);
    expect(groups[1].athleteIds).toEqual([1, 2]);
    expect(mergeTargetSelection([3], groups[1].athleteIds, true)).toEqual([3, 1, 2]);
    expect(mergeTargetSelection([1, 2, 3], groups[1].athleteIds, false)).toEqual([3]);
  });

  it("duplique le contenu et les références documentaires, jamais le feedback", () => {
    const duplicate = buildDuplicateForm({
      title: "Sprint", athleteIds: [1], documents: [{ id: 9 }],
      validations: [{ athleteId: 1, rpe: 9, comment: "Dur" }],
    }, "2026-09-22");
    expect(duplicate).toMatchObject({ title: "Sprint", athleteIds: [1], documentIds: [9], sessionDate: "2026-09-22" });
    expect(duplicate.validations).toBeUndefined();
  });
});
