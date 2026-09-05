import { describe, expect, it, vi } from "vitest";
import { trustedPushPayload, reminderIntent, dispatchTrustedPushEvents } from "../../supabase/functions/_shared/pushOutbox.ts";

const event = { id: 12, club_id: 4, actor_user_id: 7, event_type: "message_received", entity_id: 3, athlete_ids: [9], user_ids: [], claimed_at: "2026-09-05T10:00:00Z" };
function database(events = [event], error = null) {
  const update = { eq: vi.fn(() => update), then: resolve => resolve({ error: null }) };
  return { rpc: vi.fn(async () => ({ data: events, error })), from: vi.fn(() => ({ update: vi.fn(() => update) })) };
}
describe("Push issue d'un événement serveur", () => {
  it("ignore les textes, URL et modules injectés et construit un contenu discret", () => {
    const payload = trustedPushPayload({ ...event, title: "Faux coach", body: "Détail médical", url: "//evil.example", moduleKey: null });
    expect(payload).toMatchObject({ athleteIds: [9], userIds: [], title: "Nouveau message", moduleKey: "messaging", tag: "event-12", url: "/" });
    expect(JSON.stringify(payload)).not.toMatch(/médical|Faux coach|evil/);
    expect(() => trustedPushPayload({ ...event, event_type: "__proto__" })).toThrow();
  });
  it("ne reconnaît que les rappels allowlistés et les anciens tags stricts", () => {
    expect(reminderIntent({ tag: "session-feedback-12" })).toEqual({ eventType: "feedback_reminder", entityId: 12 });
    expect(reminderIntent({ eventType: "competition_reminder", entityId: 10 })).toEqual({ eventType: "competition_reminder", entityId: 10 });
    expect(reminderIntent({ tag: "comp-1evil" })).toBeNull();
    expect(reminderIntent({ eventType: "system", entityId: 10 })).toBeNull();
  });
  it("ne fait aucun envoi si la file est vide ou indisponible", async () => {
    const deliver = vi.fn();
    expect(await dispatchTrustedPushEvents(database([]), 7, deliver)).toMatchObject({ sent: 0, events: 0 });
    await expect(dispatchTrustedPushEvents(database(null, new Error("missing migration")), 7, deliver)).rejects.toThrow();
    expect(deliver).not.toHaveBeenCalled();
  });
  it("vérifie l'auteur et ne marque pas un événement terminé après erreur réseau", async () => {
    const db = database();
    const deliver = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(dispatchTrustedPushEvents(db, 7, deliver)).rejects.toThrow("offline");
    expect(db.from).not.toHaveBeenCalled();
    await expect(dispatchTrustedPushEvents(database(), 8, deliver)).rejects.toThrow("owner");
  });
  it("borne chaque livraison sans perdre de destinataire", async () => {
    const db = database([{ ...event, athlete_ids: Array.from({ length: 350 }, (_, index) => index + 1) }]);
    const deliver = vi.fn(async payload => ({ sent: payload.athleteIds.length }));
    expect(await dispatchTrustedPushEvents(db, 7, deliver)).toMatchObject({ sent: 350, events: 1 });
    expect(deliver.mock.calls.map(([payload]) => payload.athleteIds.length)).toEqual([300, 50]);
    expect(db.from).toHaveBeenCalledWith("push_event_outbox");
  });
});
