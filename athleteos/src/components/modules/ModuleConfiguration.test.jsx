import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ModulePresetPicker from "./ModulePresetPicker";
import ModuleSelector from "./ModuleSelector";

afterEach(cleanup);

describe("configuration visible des outils", () => {
  it("affiche explicitement les états ON et OFF", () => {
    render(<ModuleSelector value={["planning"]} availableKeys={["planning", "gamification"]} onChange={vi.fn()} compact />);
    expect(screen.getByLabelText("Planning : activé")).toBeTruthy();
    expect(screen.getByLabelText("Badges et progression : désactivé")).toBeTruthy();
    expect(screen.getByText("ON")).toBeTruthy();
    expect(screen.getByText("OFF")).toBeTruthy();
  });

  it("annonce Personnalisé après une modification hors preset", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<ModulePresetPicker value={["planning", "performances", "messaging"]} onSelect={onSelect} />);
    expect(screen.getByText("Essentiel", { selector: ".module-preset-status" })).toBeTruthy();
    rerender(<ModulePresetPicker value={["planning", "performances", "messaging", "gamification"]} onSelect={onSelect} />);
    expect(screen.getByText("Personnalisé")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Essentiel/ }));
    expect(onSelect).toHaveBeenCalledWith(["planning", "performances", "messaging"]);
  });
});
