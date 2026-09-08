import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WellnessQuestionnaireSettings from "./WellnessQuestionnaireSettings";

const mocks = vi.hoisted(() => ({
  fetch:vi.fn().mockResolvedValue({ versionId:null, versionNumber:1, isDefault:true, questions:[{ key:"sleep", required:true },{ key:"energy", required:true }], activeDays:[1,3,5], responseVisibility:"staff" }),
  save:vi.fn().mockResolvedValue({ versionId:4, versionNumber:2 }),
}));
vi.mock("../../services/wellnessQuestionnaireService", () => ({ fetchWellnessQuestionnaire:mocks.fetch, saveWellnessQuestionnaire:mocks.save }));

afterEach(() => { cleanup(); mocks.fetch.mockClear(); mocks.save.mockClear(); vi.restoreAllMocks(); });

describe("configuration wellness du club", () => {
  it("part du preset, ajoute une question facultative et crée une nouvelle version", async () => {
    render(<WellnessQuestionnaireSettings />);
    expect(await screen.findByText("Qualité du sommeil")).toBeTruthy();
    const motivation = screen.getByText("Motivation à s’entraîner").closest("label").querySelector("input");
    fireEvent.click(motivation);
    fireEvent.click(screen.getByRole("button", { name:"Activer cette configuration" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      activeDays:[1,3,5],
      responseVisibility:"staff",
      questions:expect.arrayContaining([{ key:"motivation", required:false }]),
    })));
    expect(await screen.findByText(/Questionnaire v2 activé/)).toBeTruthy();
  });

  it("refuse une configuration sans jour actif", async () => {
    render(<WellnessQuestionnaireSettings />);
    await screen.findByText("Qualité du sommeil");
    for (const day of ["Lundi","Mercredi","Vendredi"]) fireEvent.click(screen.getByRole("button", { name:day }));
    fireEvent.click(screen.getByRole("button", { name:"Activer cette configuration" }));
    expect(await screen.findByText("Garde au moins une question et un jour actifs.")).toBeTruthy();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
