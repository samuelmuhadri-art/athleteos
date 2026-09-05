import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AthleteModulesManager from "./AthleteModulesManager";

const moduleMocks = vi.hoisted(() => {
  const keys = ["planning", "performances", "session_feedback", "wellness", "training_load", "health", "messaging", "social", "reports", "gamification"];
  return {
    saveAthletes: vi.fn().mockResolvedValue(undefined),
    saveModuleForAthletes: vi.fn().mockResolvedValue(undefined),
    allEnabled: Object.fromEntries(keys.map((key) => [key, true])),
  };
});

vi.mock("../../hooks/useModules", () => ({
  useModules: () => ({
    athletes: [
      { id: 1, name: "Antonin Leroy", group_name: "Sprint" },
      { id: 2, name: "Alice Martin", group_name: "Sprint" },
    ],
    athlete: { 1: moduleMocks.allEnabled, 2: moduleMocks.allEnabled },
    club: moduleMocks.allEnabled,
    saveAthletes: moduleMocks.saveAthletes,
    saveModuleForAthletes: moduleMocks.saveModuleForAthletes,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("gestion des outils athlète", () => {
  it("ouvre directement la configuration d’Antonin et applique un changement", async () => {
    const onClose = vi.fn();
    render(<AthleteModulesManager initialAthleteId={1} onClose={onClose} />);
    expect(screen.getByText("Ce que Antonin voit dans AthleteOS.")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByLabelText("Badges et progression : activé"));
    expect(screen.getByText("Personnalisé")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));
    await waitFor(() => expect(moduleMocks.saveAthletes).toHaveBeenCalledWith([1], expect.not.arrayContaining(["gamification"])));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("gère la même source de vérité dans le sens outil vers athlètes", async () => {
    render(<AthleteModulesManager onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Par outil" }));
    fireEvent.click(screen.getByRole("button", { name: /Badges et progression\s*2\/2/ }));
    fireEvent.click(screen.getByText("Antonin Leroy").closest("label").querySelector("input"));
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));
    await waitFor(() => expect(moduleMocks.saveModuleForAthletes).toHaveBeenCalledWith("gamification", [2]));
  });

  it("permet toujours de passer d’un athlète à plusieurs", () => {
    render(<AthleteModulesManager initialAthleteId={1} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Choisir d’autres athlètes" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getAllByRole("checkbox")[0].checked).toBe(true);
  });
});
