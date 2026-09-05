import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AddSessionModal from "./AddSessionModal";

vi.mock("../utils/supabaseClient", () => ({ supabase: { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [] }) }) }) } }));
vi.mock("../components/documents/DocumentLibraryField", () => ({ default: () => <div>Bibliothèque</div> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const athletes = [{ id: 10, name: "Alice Martin" }];

describe("formulaire de séance simplifié", () => {
  it("reprend date et participants du contexte sans modifier les valeurs métier par défaut", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<AddSessionModal athletes={athletes} initialDate="2026-09-09" initialAthleteIds={[10]} onClose={vi.fn()} onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "Sprint" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter", exact: true }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      sessionDate: "2026-09-09", athleteIds: [10], day: "Mercredi", recurrence: "none", durationMinutes: 60, trainingFocus: "sprint_general",
    }), expect.any(String)));
  });

  it("préserve les champs avancés, documents et portée individuelle lors d’une modification de titre", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const documents = [{ id: 7, visibility: "selected", athleteIds: [10] }];
    render(<AddSessionModal athletes={athletes} initialData={{ title: "Sprint", category: "sprint", trainingFocus: "sprint_general", sessionDate: "2026-09-09", time: "18:00", durationMinutes: 60, description: "6 × 40 m", instructions: "Récupération 4 min", athleteIds: [10], seriesId: 42, documents }} onClose={vi.fn()} onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "Sprint ajusté" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer", exact: true }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: "Sprint ajusté", instructions: "Récupération 4 min", documents, editScope: "single", seriesId: 42,
    }), expect.any(String)));
  });

  it("conserve la protection contre la perte de modifications", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onClose = vi.fn();
    render(<AddSessionModal athletes={athletes} onClose={onClose} onAdd={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Titre *"), { target: { value: "Brouillon" } });
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });
});
