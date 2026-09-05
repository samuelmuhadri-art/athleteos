import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ handlers: [], status: null, removeChannel: vi.fn(), channel: vi.fn() }));
vi.mock("../utils/supabaseClient", () => ({ supabase: { channel: mocks.channel, removeChannel: mocks.removeChannel } }));
import { useMessageRealtime } from "./useMessageRealtime";

beforeEach(() => {
  mocks.handlers = []; mocks.removeChannel.mockClear(); mocks.channel.mockReset();
  const channel = { on: vi.fn((_, filter, handler) => { mocks.handlers.push({ filter, handler }); return channel; }), subscribe: vi.fn(callback => { mocks.status = callback; return channel; }) };
  mocks.channel.mockReturnValue(channel);
});
afterEach(cleanup);
describe("messages coach en temps réel", () => {
  it("s'abonne aux INSERT et UPDATE entrants/sortants avec filtre utilisateur", () => {
    const onMessage = vi.fn();
    renderHook(() => useMessageRealtime({ userId: 7, onMessage }));
    expect(mocks.handlers.filter(({ filter }) => filter.event).map(({ filter }) => [filter.event, filter.filter])).toEqual([
      ["INSERT", "sender_id=eq.7"], ["INSERT", "receiver_id=eq.7"], ["UPDATE", "sender_id=eq.7"], ["UPDATE", "receiver_id=eq.7"],
    ]);
    const row = { id: 1, sender_id: 9, receiver_id: 7, content: "Bonjour" };
    act(() => mocks.handlers[1].handler({ new: row, eventType: "INSERT" }));
    expect(onMessage).toHaveBeenCalledWith(row, "INSERT");
    act(() => mocks.handlers[0].handler({ new: { id: 2, sender_id: 8, receiver_id: 9 }, eventType: "INSERT" }));
    expect(onMessage).toHaveBeenCalledTimes(1);
  });
  it("rattrape les messages à la reconnexion et ignore les événements après démontage", () => {
    const onMessage = vi.fn(), onCatchUp = vi.fn();
    const { unmount } = renderHook(() => useMessageRealtime({ userId: 7, onMessage, onCatchUp }));
    act(() => { mocks.status("SUBSCRIBED"); window.dispatchEvent(new Event("online")); });
    expect(onCatchUp).toHaveBeenCalledTimes(2);
    act(() => mocks.handlers[4].handler({ extension: "postgres_changes", status: "ok" }));
    expect(onCatchUp).toHaveBeenCalledTimes(3);
    unmount();
    expect(mocks.removeChannel).toHaveBeenCalledOnce();
    act(() => mocks.handlers[0].handler({ new: { id: 1, sender_id: 7, receiver_id: 9 }, eventType: "UPDATE" }));
    expect(onMessage).not.toHaveBeenCalled();
  });
  it("n'ouvre pas de canal sans compte et garde le callback actuel sans réabonnement", () => {
    const first = vi.fn(), next = vi.fn();
    const { rerender } = renderHook(({ userId, onMessage }) => useMessageRealtime({ userId, onMessage }), { initialProps: { userId: null, onMessage: first } });
    expect(mocks.channel).not.toHaveBeenCalled();
    rerender({ userId: 7, onMessage: first });
    rerender({ userId: 7, onMessage: next });
    act(() => mocks.handlers[0].handler({ new: { id: 1, sender_id: 7, receiver_id: 9 }, eventType: "INSERT" }));
    expect(first).not.toHaveBeenCalled(); expect(next).toHaveBeenCalledOnce(); expect(mocks.channel).toHaveBeenCalledOnce();
  });
});
