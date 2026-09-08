import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WellnessModal from "./WellnessModal";

const mocks = vi.hoisted(() => ({
  submit:vi.fn().mockResolvedValue({ wellnessId:7, questionnaireVersionId:3 }),
}));
vi.mock("../../services/wellnessQuestionnaireService", () => ({ submitWellnessResponse:mocks.submit }));

afterEach(() => { cleanup(); mocks.submit.mockClear(); vi.restoreAllMocks(); });

describe("questionnaire wellness athlète", () => {
  it("exige seulement les questions obligatoires et conserve les facultatives", async () => {
    const onSaved = vi.fn();
    render(<WellnessModal configuration={{ versionId:3, questions:[{ key:"sleep", required:true },{ key:"motivation", required:false }], activeDays:[1,3,5] }} onClose={vi.fn()} onSaved={onSaved} />);
    expect(screen.getByLabelText("1 question obligatoire restante")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Qualité du sommeil : 4 — Bonne"));
    fireEvent.click(screen.getByLabelText("Valider le questionnaire"));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ answers:{ sleep:4, motivation:null } })));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ sleep:4, energy:null, answers:{ sleep:4, motivation:null }, questionnaireVersionId:3 }));
  });

  it("préremplit la version et les réponses existantes lors d'une modification", () => {
    render(<WellnessModal configuration={{ questions:[{ key:"sleep", required:true }] }} existingWellness={{ sleep:3, answers:{ sleep:5 }, notes:"Nuit courte" }} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByLabelText("Qualité du sommeil : 5 — Excellente").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByPlaceholderText("Contexte, ressenti particulier…").value).toBe("Nuit courte");
    expect(screen.getByLabelText("Valider le questionnaire")).toBeTruthy();
  });
});
