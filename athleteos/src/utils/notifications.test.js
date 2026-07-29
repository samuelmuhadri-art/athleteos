import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inserts: [],
  updates: [],
  invoke: vi.fn(),
  existingAlert: null,
}));

vi.mock("./supabaseClient", () => {
  const makeQuery = (table) => {
    const query = {};
    ["select", "eq", "in", "gte", "order", "limit", "ilike"].forEach(method => {
      query[method] = vi.fn(() => query);
    });
    query.maybeSingle = vi.fn(async () => ({ data: mocks.existingAlert, error: null }));
    query.insert = vi.fn((payload) => {
      mocks.inserts.push({ table, payload });
      return query;
    });
    query.update = vi.fn((payload) => {
      mocks.updates.push({ table, payload });
      return query;
    });
    return query;
  };
  return {
    supabase: {
      from: vi.fn((table) => makeQuery(table)),
      functions: { invoke: mocks.invoke },
    },
  };
});

import {
  notifyCoachAthleteSession,
  notifyCoachClubPost,
  notifyCoachSessionResponse,
} from "./notifications";

beforeEach(() => {
  mocks.inserts.length = 0;
  mocks.updates.length = 0;
  mocks.existingAlert = null;
  mocks.invoke.mockReset().mockResolvedValue({ data: { ok: true }, error: null });
});

describe("notifications coach liées aux actions athlète", () => {
  it("enregistre l'absence avec son message et envoie la push au coach", async () => {
    await notifyCoachSessionResponse(4, 91, { id: 8, name: "Alice Martin" }, { id: 12, title: "Vitesse" }, "unavailable", "Je suis chez le kiné.");

    const alert = mocks.inserts.find(call => call.table === "alerts")?.payload;
    expect(alert).toMatchObject({ club_id: 4, athlete_id: 8, session_id: 12, type: "session_response", is_read: false });
    expect(alert.description).toContain("Je suis chez le kiné.");
    expect(mocks.invoke).toHaveBeenCalledWith("send-push", expect.objectContaining({
      body: expect.objectContaining({ userIds: [91], tag: "session-response-12" }),
    }));
  });

  it("ne dérange pas le coach pour une confirmation de présence normale", async () => {
    await notifyCoachSessionResponse(4, 91, { id: 8, name: "Alice" }, { id: 12, title: "Vitesse" }, "going");
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("conserve l'alerte dans l'application même si la push coach n'est pas disponible", async () => {
    await notifyCoachSessionResponse(4, null, { id: 8, name: "Alice" }, { id: 12, title: "Vitesse" }, "unsure", "Je confirme demain.");
    expect(mocks.inserts.find(call => call.table === "alerts")?.payload.type).toBe("session_response");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("notifie le coach pour une séance créée et une photo publiée", async () => {
    const athlete = { id: 8, name: "Alice Martin" };
    await notifyCoachAthleteSession(4, 91, athlete, { id: 21, title: "Technique", sessionDate: "2026-08-03" });
    await notifyCoachClubPost(4, 91, athlete, { hasPhoto: true, caption: "Belle séance avec le groupe" });

    expect(mocks.inserts.filter(call => call.table === "alerts").map(call => call.payload.type)).toEqual([
      "athlete_session", "social_post",
    ]);
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });
});
