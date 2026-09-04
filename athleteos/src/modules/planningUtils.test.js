import { describe, expect, it } from "vitest";
import {
  audienceMatchesFilters,
  competitionMatchesDiscipline,
  indexPlanningRelations,
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

describe("indexation des relations du planning", () => {
  it("isole les affectations et destinataires par seance et document", () => {
    const index = indexPlanningRelations(
      [
        { session_id: 10, athlete_id: 1 },
        { session_id: 10, athlete_id: 2 },
        { session_id: 11, athlete_id: 3 },
      ],
      [
        { session_id: 10, document_id: 100 },
        { session_id: 11, document_id: 100 },
      ],
      [
        { session_id: 10, document_id: 100, athlete_id: 1 },
        { session_id: 11, document_id: 100, athlete_id: 3 },
      ],
    );

    expect(index.athletesBySessionId.get(10).map(row => row.athlete_id)).toEqual([1, 2]);
    expect(index.documentsBySessionId.get(11).map(row => row.document_id)).toEqual([100]);
    expect(index.recipientIds(10, 100)).toEqual([1]);
    expect(index.recipientIds(11, 100)).toEqual([3]);
    expect(index.recipientIds(12, 100)).toEqual([]);
  });
});
