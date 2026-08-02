import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import AppStatusBanner from "./AppStatusBanner";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppStatusBanner", () => {
  it("prévient clairement quand la connexion est perdue", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<AppStatusBanner />);

    expect(screen.getByText("Mode hors connexion")).toBeTruthy();
    expect(screen.getByText(/certaines données/i)).toBeTruthy();
    expect(document.documentElement.classList.contains("has-app-status-banner")).toBe(true);
  });

  it("disparaît quand la connexion revient", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<AppStatusBanner />);
    expect(screen.getByText("Mode hors connexion")).toBeTruthy();

    act(() => window.dispatchEvent(new Event("online")));
    expect(screen.queryByText("Mode hors connexion")).toBeNull();
    expect(document.documentElement.classList.contains("has-app-status-banner")).toBe(false);
  });
});
