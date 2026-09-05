import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ events: [], readError: null, updates: [], messages: [], remove: vi.fn() }));
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ profile: { id: 1, name: "Camille" }, clubId: 4 }) }));
vi.mock("../utils/notifications", () => ({ notifyAthleteMessage: vi.fn(), notifyCoachMessage: vi.fn() }));
vi.mock("../utils/supabaseClient", () => ({ supabase: {
  from(table) {
    let update = false;
    const query = {};
    for (const method of ["select", "eq", "neq", "or", "order", "limit", "in"]) query[method] = () => query;
    query.update = payload => { update = true; mocks.updates.push(payload); return query; };
    query.then = resolve => resolve({ data: table === "athletes" ? [{ id: 8, name: "Alice Martin", user_id: 2 }] : table === "users" ? [] : mocks.messages, error: update ? mocks.readError : null });
    return query;
  },
  channel() { const channel = { on: (_, filter, callback) => { mocks.events.push({ filter, callback }); return channel; }, subscribe: () => channel }; return channel; },
  removeChannel: mocks.remove,
} }));
import Messaging from "./Messaging";

beforeEach(() => { mocks.events = []; mocks.updates = []; mocks.messages = []; mocks.readError = null; Element.prototype.scrollIntoView = vi.fn(); });
afterEach(cleanup);
const incoming = { id: 55, sender_id: 2, receiver_id: 1, content: "Je serai présent", created_at: "2026-09-05T12:00:00Z", is_read: false };
function receive(row, eventType = "INSERT") { mocks.events.find(({ filter }) => filter.event === eventType && filter.filter === "receiver_id=eq.1").callback({ new: row, eventType }); }
describe("conversation coach ouverte", () => {
  it("affiche une réponse entrante sans recharger ni perdre le brouillon et sans doublon", async () => {
    render(<Messaging />);
    fireEvent.click(await screen.findByRole("button", { name: /Alice Martin/ }));
    fireEvent.change(screen.getByPlaceholderText("Message à Alice…"), { target: { value: "Mon brouillon" } });
    await act(async () => { receive(incoming); receive(incoming); });
    const thread = screen.getByRole("region", { name: "Conversation Alice Martin" });
    expect(thread.textContent.match(/Je serai présent/g)).toHaveLength(1);
    expect(screen.getByPlaceholderText("Message à Alice…").value).toBe("Mon brouillon");
    expect(mocks.updates.length).toBeGreaterThan(0);
  });
  it("signale un échec de lecture sans masquer la conversation", async () => {
    mocks.readError = new Error("offline");
    render(<Messaging />);
    fireEvent.click(await screen.findByRole("button", { name: /Alice Martin/ }));
    await act(async () => { receive(incoming); });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("statut de lecture"));
    expect(screen.getByRole("region", { name: "Conversation Alice Martin" }).textContent).toContain("Je serai présent");
  });
});
