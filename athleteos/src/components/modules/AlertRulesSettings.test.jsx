import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAlertRules } from "../../domain/alertRules";
import AlertRulesSettings from "./AlertRulesSettings";

const mocks = vi.hoisted(() => ({ fetch:vi.fn(), save:vi.fn() }));
vi.mock("../../services/alertRulesService", () => ({
  fetchAlertRules:(...args) => mocks.fetch(...args),
  saveAlertRules:(...args) => mocks.save(...args),
}));
vi.mock("../../hooks/useModules", () => ({ useModules:() => ({
  athletes:[{ id:1, group_name:"Sprint" }, { id:2, group_name:"Demi-fond" }],
  club:{ wellness:true, session_feedback:true, performances:true, training_load:false },
}) }));

beforeEach(() => {
  const rules = normalizeAlertRules([]);
  mocks.fetch.mockReset().mockResolvedValue(rules);
  mocks.save.mockReset().mockImplementation(async value => value);
});
afterEach(cleanup);

describe("AlertRulesSettings", () => {
  it("affiche le catalogue fermé et la dépendance aux outils", async () => {
    render(<AlertRulesSettings />);
    expect(await screen.findByText("Wellness non renseigné")).toBeTruthy();
    expect(screen.getByText("Variation de charge observée")).toBeTruthy();
    expect(screen.getByText("En pause · outil désactivé")).toBeTruthy();
    expect(screen.getByText(/aucun diagnostic/i)).toBeTruthy();
  });

  it("enregistre seuil, groupe, sévérité et destinataires", async () => {
    render(<AlertRulesSettings />);
    fireEvent.click(await screen.findByLabelText("Activer Wellness non renseigné"));
    fireEvent.change(screen.getByLabelText("Population"), { target:{ value:"Sprint" } });
    fireEvent.change(screen.getByLabelText("Niveau"), { target:{ value:"critique" } });
    fireEvent.change(screen.getByLabelText("Destinataires"), { target:{ value:"head_coach" } });
    fireEvent.click(screen.getByRole("button", { name:"Enregistrer les règles" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][0][0]).toMatchObject({ enabled:true, targetGroup:"Sprint", severity:"critique", recipientScope:"head_coach" });
  });

  it("explique une valeur hors limites sans la modifier silencieusement", async () => {
    render(<AlertRulesSettings />);
    fireEvent.click(await screen.findByLabelText("Activer Sommeil sous le seuil"));
    fireEvent.change(screen.getByLabelText("Seuil maximal"), { target:{ value:"9" } });
    fireEvent.click(screen.getByRole("button", { name:"Enregistrer les règles" }));
    expect(screen.getByRole("status").textContent).toContain("compris entre 1 et 4");
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
