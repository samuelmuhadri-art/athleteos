import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PushToggleButton } from "./usePushNotifications";

beforeEach(() => {
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {} });
  vi.stubGlobal("PushManager", function PushManager() {});
});

afterEach(() => {
  cleanup();
  delete navigator.serviceWorker;
  vi.unstubAllGlobals();
});

describe("PushToggleButton", () => {
  it("garde la même action dans sa variante compacte mobile", () => {
    const onToggle = vi.fn();
    render(<PushToggleButton subscribed={false} onToggle={onToggle} permissionState="default" compact />);

    const button = screen.getByRole("button", { name: "Activer les notifications" });
    expect(screen.queryByText("Activer les notifs")).toBeNull();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("reste désactivé quand la permission est refusée", () => {
    render(<PushToggleButton subscribed={false} onToggle={vi.fn()} permissionState="denied" compact />);
    expect(screen.getByRole("button", { name: "Notifications bloquées par le navigateur" }).disabled).toBe(true);
  });
});
