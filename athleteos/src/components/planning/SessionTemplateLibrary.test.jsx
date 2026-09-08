import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SessionTemplateLibrary from "./SessionTemplateLibrary";

const mocks = vi.hoisted(() => ({
  templates:[{
    id:12, name:"Départs blocs", title:"Accélération", category:"sprint", type:"Sprint",
    training_focus:"acceleration", duration_minutes:45, description:"4 × 30 m", instructions:null,
    scope:"club", tags:["100 m"], created_by:5, session_template_documents:[],
  }],
  rpc:vi.fn().mockResolvedValue({ data:{ templateId:13 }, error:null }),
}));

vi.mock("../../utils/supabaseClient", () => ({
  supabase:{
    from:() => ({ select:() => ({ order:() => Promise.resolve({ data:mocks.templates, error:null }) }) }),
    rpc:mocks.rpc,
  },
}));
vi.mock("../../services/documentLibrary", () => ({ mapDocument:document => document }));

afterEach(() => { cleanup(); mocks.rpc.mockClear(); vi.restoreAllMocks(); });

const draft = { title:"Brouillon sprint", category:"sprint", type:"Sprint", trainingFocus:"acceleration", durationMinutes:60, description:"6 × 40 m", instructions:"4 min" };

describe("bibliothèque UI des modèles", () => {
  it("filtre et applique un modèle au brouillon courant", async () => {
    const onApply = vi.fn();
    render(<SessionTemplateLibrary draft={draft} documents={[]} currentUserId={5} onApply={onApply} />);
    expect(await screen.findByText("Départs blocs")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Rechercher nom, contenu ou tag"), { target:{ value:"100 m" } });
    fireEvent.click(screen.getByText("Départs blocs"));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ id:12, title:"Accélération", documents:[] }));
  });

  it("enregistre le brouillon comme modèle personnel par défaut", async () => {
    render(<SessionTemplateLibrary draft={draft} documents={[{ id:9 }]} currentUserId={5} onApply={vi.fn()} />);
    await screen.findByText("Départs blocs");
    fireEvent.click(screen.getByRole("button", { name:"Enregistrer ce brouillon" }));
    expect(screen.getByLabelText("Nom du modèle").value).toBe("Brouillon sprint");
    fireEvent.click(screen.getByRole("button", { name:"Enregistrer le modèle" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("upsert_session_template", expect.objectContaining({
      p_template_id:null,
      p_document_ids:[9],
      p_template:expect.objectContaining({ name:"Brouillon sprint", scope:"personal", durationMinutes:60 }),
    })));
  });

  it("permet au head coach de modifier un modèle club sans le privatiser", async () => {
    render(<SessionTemplateLibrary draft={draft} documents={[]} currentUserId={99} isHeadCoach onApply={vi.fn()} />);
    await screen.findByText("Départs blocs");
    fireEvent.click(screen.getByRole("button", { name:"Modifier Départs blocs" }));
    expect(screen.getByLabelText("Portée du modèle").disabled).toBe(true);
  });
});
