/* @vitest-environment jsdom */
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import DashboardSettings from "./DashboardSettings";
import DashboardLayout from "./DashboardLayout";
import { normalizeDashboardPreferences } from "../../domain/dashboardPreferences";
import { saveDashboardPreferences } from "../../services/dashboardPreferencesService";
vi.mock("../../services/dashboardPreferencesService", () => ({ saveDashboardPreferences:vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("dashboard settings", () => {
  it("renders outside animated dashboard ancestors so the footer stays in the viewport", () => {
    const { container } = render(<div style={{ transform:"translateY(0)" }}>
      <DashboardSettings preferences={normalizeDashboardPreferences(null)} groups={[]} onClose={vi.fn()} onSaved={vi.fn()} />
    </div>);
    const dialog = screen.getByRole("dialog", { name:"Personnaliser mon accueil" });
    expect(document.body.contains(dialog)).toBe(true);
    expect(container.contains(dialog)).toBe(false);
  });
  it("saves personal visibility, order, group and period", async () => {
    const onSaved = vi.fn(); saveDashboardPreferences.mockImplementation(async value => value);
    render(<DashboardSettings preferences={normalizeDashboardPreferences(null)} groups={["Sprint"]} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByLabelText("Synthèse wellness"));
    fireEvent.click(screen.getByLabelText("Monter Vue d’ensemble"));
    fireEvent.change(screen.getByLabelText("Groupe par défaut"),{target:{value:"Sprint"}});
    fireEvent.change(screen.getByLabelText("Période des feedbacks récents"),{target:{value:"14"}});
    fireEvent.click(screen.getByRole("button",{name:"Enregistrer"}));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ order:["priorities","overview","wellness","followup"],hidden:["wellness"],defaultGroup:"Sprint",feedbackDays:14 }));
  });
  it("keeps the draft on failure and resets only after explicit saving", async () => {
    saveDashboardPreferences.mockRejectedValue(new Error("Serveur indisponible"));
    const onSaved = vi.fn();
    render(<DashboardSettings preferences={normalizeDashboardPreferences({hidden:["overview"]})} groups={[]} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button",{name:"Enregistrer"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Serveur indisponible");
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Rétablir les valeurs par défaut"}));
    expect(screen.getByLabelText("Vue d’ensemble")).toBeChecked();
    expect(saveDashboardPreferences).toHaveBeenCalledTimes(1);
  });
  it("orders the DOM, omits disabled modules and hides selected blocks", () => {
    const wellnessEnabled = false;
    const { container } = render(<DashboardLayout preferences={normalizeDashboardPreferences({order:["followup","wellness","overview","priorities"],hidden:["priorities"]})}>
      <section data-dashboard-block="priorities">Priorités</section>
      {wellnessEnabled && <section data-dashboard-block="wellness">Wellness</section>}
      <section data-dashboard-block="overview">Overview</section>
      <section data-dashboard-block="followup">Followup</section>
    </DashboardLayout>);
    expect([...container.children].map(item => item.textContent)).toEqual(["Followup","Overview"]);
  });
});
