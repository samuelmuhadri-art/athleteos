import { describe, expect, it, vi } from "vitest";
import { fetchPrimaryHeadCoach, fetchAthleteSessions, fetchAthleteCompetitions, fetchAthletePlanningEvents } from "./athleteShellData";

describe("chargement des donnees du shell athlete", () => {
  it.each([
    [fetchAthleteSessions, "sessions", "session_athletes"],
    [fetchAthleteCompetitions, "competitions", "competition_athletes"],
    [fetchAthletePlanningEvents, "planning_events", "planning_event_athletes"],
  ])("filtre les données au serveur sans supprimer les participants ni tronquer l'historique", (fetcher, table, relation) => {
    const query = { select: vi.fn(), eq: vi.fn() }; query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    const client = { from: vi.fn(() => query) };
    fetcher(client, 4, 8);
    expect(client.from).toHaveBeenCalledWith(table);
    expect(query.select.mock.calls[0][0]).toContain(`membership:${relation}!inner(athlete_id)`);
    expect(query.select.mock.calls[0][0]).toContain(`${relation}(`);
    expect(query.eq.mock.calls).toEqual([["club_id", 4], ["membership.athlete_id", 8]]);
  });
  it("selectionne un head coach de facon deterministe sans exiger une ligne unique", async () => {
    const response = { data:[{ id:3, name:"Coach A" }], error:null };
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn().mockResolvedValue(response),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    const client = { from:vi.fn().mockReturnValue(query) };

    await expect(fetchPrimaryHeadCoach(client, 7)).resolves.toEqual(response);
    expect(client.from).toHaveBeenCalledWith("users");
    expect(query.eq).toHaveBeenNthCalledWith(1, "club_id", 7);
    expect(query.eq).toHaveBeenNthCalledWith(2, "role", "head_coach");
    expect(query.order).toHaveBeenCalledWith("id", { ascending:true });
    expect(query.limit).toHaveBeenCalledWith(1);
  });
});
