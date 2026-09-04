import { describe, expect, it, vi } from "vitest";
import { fetchPrimaryHeadCoach } from "./athleteShellData";

describe("chargement des donnees du shell athlete", () => {
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
