import { describe, expect, it, vi } from "vitest";
import { persistCurrentPushSubscription, revokeCurrentPushSubscription } from "./pushSubscriptions";

function subscription(endpoint) {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: "p256dh", auth: "auth" } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

function clientWithInsertResults(...errors) {
  const inserts = [];
  const deletes = [];
  const client = {
    from: vi.fn(() => ({
      delete: () => ({
        eq: async (_column, endpoint) => {
          deletes.push(endpoint);
          return { error: null };
        },
      }),
      insert: async (payload) => {
        inserts.push(payload);
        return { error: errors.shift() ?? null };
      },
    })),
  };
  return { client, inserts, deletes };
}

describe("pushSubscriptions", () => {
  it("supprime la ligne puis révoque l’abonnement avant une déconnexion", async () => {
    const current = subscription("https://push.test/current");
    const { client, deletes } = clientWithInsertResults();
    const serviceWorker = {
      getRegistration: vi.fn().mockResolvedValue({
        pushManager: { getSubscription: vi.fn().mockResolvedValue(current) },
      }),
    };

    const result = await revokeCurrentPushSubscription(client, serviceWorker);

    expect(deletes).toEqual(["https://push.test/current"]);
    expect(current.unsubscribe).toHaveBeenCalledOnce();
    expect(result).toEqual({ found: true, databaseError: null, browserRevoked: true });
  });

  it("ne fait rien quand aucun abonnement navigateur n’existe", async () => {
    const { client } = clientWithInsertResults();
    const serviceWorker = {
      getRegistration: vi.fn().mockResolvedValue({
        pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
      }),
    };

    await expect(revokeCurrentPushSubscription(client, serviceWorker)).resolves.toMatchObject({ found: false });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("remplace un endpoint appartenant à un ancien compte", async () => {
    const oldSubscription = subscription("https://push.test/old");
    const newSubscription = subscription("https://push.test/new");
    const { client, inserts } = clientWithInsertResults({ code: "23505" }, null);
    const registration = {
      pushManager: { subscribe: vi.fn().mockResolvedValue(newSubscription) },
    };

    const result = await persistCurrentPushSubscription({
      supabaseClient: client,
      registration,
      subscription: oldSubscription,
      applicationServerKey: new Uint8Array([1, 2, 3]),
      clubId: 4,
      athleteId: 8,
    });

    expect(oldSubscription.unsubscribe).toHaveBeenCalledOnce();
    expect(registration.pushManager.subscribe).toHaveBeenCalledOnce();
    expect(inserts.map((value) => value.endpoint)).toEqual([
      "https://push.test/old",
      "https://push.test/new",
    ]);
    expect(inserts[1]).toMatchObject({ club_id: 4, athlete_id: 8, user_id: null });
    expect(result).toEqual({ subscription: newSubscription, error: null });
  });
});
