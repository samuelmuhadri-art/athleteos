import { describe, expect, it } from "vitest";
import {
  audienceMatchesFilters,
  competitionMatchesDiscipline,
  sessionMatchesDiscipline,
} from "./planningUtils";

describe("filtres sémantiques du planning coach", () => {
  const athletes = [
    { id: 1, group: "Sprint" },
    { id: 2, group: "Lancers" },
    { id: 3, group: "Sprint" },
  ];

  it("combine réellement groupe et athlète", () => {
    expect(audienceMatchesFilters([1, 2], { athleteId: 2, group: "Sprint", athletes })).toBe(false);
    expect(audienceMatchesFilters([1, 2], { athleteId: 2, group: "Lancers", athletes })).toBe(true);
    expect(audienceMatchesFilters([2], { group: "Sprint", athletes })).toBe(false);
  });

  it("filtre une séance sur son type ou sa catégorie, pas sur la discipline principale de l’athlète", () => {
    expect(sessionMatchesDiscipline({ category: "lancer", type: "Poids" }, "lancer")).toBe(true);
    expect(sessionMatchesDiscipline({ category: "sprint", type: "Sprint" }, "lancer")).toBe(false);
    expect(sessionMatchesDiscipline({ category: null, type: "Lancer" }, "lancer")).toBe(true);
  });

  it("reconnaît la famille des épreuves prévues en compétition", () => {
    expect(competitionMatchesDiscipline({ plannedEvents: { 1: "Poids", 2: "100 m" } }, "lancer")).toBe(true);
    expect(competitionMatchesDiscipline({ plannedEvents: { 1: "100 m" } }, "lancer")).toBe(false);
  });
});
