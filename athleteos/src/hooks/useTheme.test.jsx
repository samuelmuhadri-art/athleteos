import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useTheme } from "./useTheme";
import { ThemeToggleButton } from "../components/ui/ThemeToggleButton";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(cleanup);

describe("useTheme", () => {
  it("démarre en mode sombre par défaut et applique l'attribut sur <html>", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("bascule vers le mode clair et le persiste", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("athleteos-theme")).toBe("light");
  });

  it("reprend la préférence sauvegardée au prochain montage", () => {
    localStorage.setItem("athleteos-theme", "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
  });
});

describe("ThemeToggleButton", () => {
  it("déclenche le changement de thème au clic", () => {
    const onToggle = vi.fn();
    render(<ThemeToggleButton theme="dark" onToggle={onToggle} compact />);
    fireEvent.click(screen.getByRole("button", { name: "Passer en mode clair" }));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
