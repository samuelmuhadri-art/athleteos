import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ModuleOnboardingModal from "./ModuleOnboardingModal";

const fixture = vi.hoisted(() => ({ athletes: [], configuredAt: null, saveClub: vi.fn(), saveAthletes: vi.fn() }));
vi.mock("../../hooks/useModules", () => ({ useModules: () => ({ ...fixture, loading: false, club: { planning: true, performances: true, messaging: true } }) }));
beforeEach(() => {
  fixture.athletes = [];
  fixture.configuredAt = null;
  fixture.saveClub.mockReset().mockResolvedValue(undefined);
  fixture.saveAthletes.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("premiers outils du club", () => {
  it("termine en une étape sans écrire de configuration d’athlète pour un club vide", async () => {
    render(<ModuleOnboardingModal />);
    expect(screen.queryByRole("button", { name: "Continuer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Essentiel/ }));
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    await waitFor(() => expect(fixture.saveClub).toHaveBeenCalledWith(["planning", "performances", "messaging"]));
    expect(fixture.saveAthletes).not.toHaveBeenCalled();
  });

  it("conserve le choix du suivi commun pour les athlètes existants", async () => {
    fixture.athletes = [{ id: 10 }];
    render(<ModuleOnboardingModal />);
    fireEvent.click(screen.getByRole("button", { name: /^Essentiel/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    expect(screen.getByRole("heading", { name: "Comment veux-tu suivre tes athlètes ?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    await waitFor(() => expect(fixture.saveAthletes).toHaveBeenCalledWith([10], ["planning", "performances", "messaging"]));
  });

  it("garde visible l’échec du suivi individuel même si le club a été enregistré", async () => {
    fixture.athletes = [{ id: 10 }];
    fixture.saveClub.mockImplementation(async () => { fixture.configuredAt = "2026-09-07"; });
    fixture.saveAthletes.mockRejectedValue(new Error("Réessaie dans un instant."));
    render(<ModuleOnboardingModal />);
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Réessaie dans un instant.");
    expect(screen.getByRole("button", { name: "Terminer" }).disabled).toBe(false);
  });
});
