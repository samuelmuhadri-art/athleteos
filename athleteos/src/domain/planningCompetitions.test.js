import { describe, expect, it } from "vitest";
import { getPlanningCompetitions, groupCompetitionsByDate } from "./planningCompetitions";

const competitions = [
  { id: 1, name: "Meeting", date: "2026-09-12", athleteIds: [10, 11] },
  { id: 2, name: "Championnat", date: "2026-09-12", athleteIds: [11] },
  { id: 3, name: "Sans date", date: null, athleteIds: [10] },
];

describe("planning competitions", () => {
  it("ne garde pour un athlète que les compétitions auxquelles il est inscrit", () => {
    expect(getPlanningCompetitions(competitions, 10).map(item => item.id)).toEqual([1]);
  });

  it("conserve toutes les compétitions datées pour le planning coach", () => {
    expect(getPlanningCompetitions(competitions).map(item => item.id)).toEqual([1, 2]);
  });

  it("regroupe les compétitions par jour", () => {
    expect(groupCompetitionsByDate(competitions, 11)["2026-09-12"]).toHaveLength(2);
  });
});
