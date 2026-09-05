import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
vi.mock("../utils/supabaseClient", () => ({ supabase: {} }));
vi.mock("../utils/pushSubscriptions", () => ({ persistCurrentPushSubscription: vi.fn(async () => ({ error: null })) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); delete navigator.serviceWorker; });
describe("consentement Push", () => {
  it("n'ouvre aucune permission au montage et la demande seulement à l'activation", async () => {
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "BAAAA");
    const requestPermission = vi.fn(async () => "denied");
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    vi.stubGlobal("PushManager", function PushManager() {});
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: vi.fn(async () => ({ pushManager: { getSubscription: vi.fn(async () => null) } })) } });
    const { usePushNotifications } = await import("./usePushNotifications");
    const { result } = renderHook(() => usePushNotifications(8, 4));
    await waitFor(() => expect(result.current.swReady).toBe(true));
    expect(requestPermission).not.toHaveBeenCalled();
    await act(async () => result.current.subscribe());
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(result.current.permissionState).toBe("denied");
    expect(result.current.subscribed).toBe(false);
  });
});
