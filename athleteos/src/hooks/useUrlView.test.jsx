import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useUrlView } from "./useUrlView";

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
describe("historique des vues", () => {
  it("remplace une vue devenue inaccessible sans ajouter d'entrée", () => {
    window.history.replaceState(null, "", "/planning");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useUrlView(["dashboard", "planning"], "dashboard"));
    const length = window.history.length;
    act(() => result.current.navigate("dashboard", { replace: true }));
    expect(replace).toHaveBeenLastCalledWith({ view: "dashboard" }, "", "/dashboard");
    expect(push).not.toHaveBeenCalled();
    expect(window.history.length).toBe(length);
    expect(result.current.activeView).toBe("dashboard");
  });
  it("conserve pushState pour une navigation normale et réagit à Retour", () => {
    window.history.replaceState(null, "", "/dashboard");
    const push = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(() => useUrlView(["dashboard", "planning"], "dashboard"));
    act(() => result.current.navigate("planning"));
    expect(push).toHaveBeenCalledWith({ view: "planning" }, "", "/planning");
    act(() => { window.history.replaceState(null, "", "/dashboard"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(result.current.activeView).toBe("dashboard");
  });
});
