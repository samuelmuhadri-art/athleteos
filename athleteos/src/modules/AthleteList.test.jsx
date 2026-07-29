import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AthleteList from "./AthleteList";

const mocks = vi.hoisted(() => ({
  auth: {
    clubId: 7,
    profile: { id: 12, role: "head_coach", name: "Coach Nora" },
  },
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("../utils/supabaseClient", () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

function makeCsvFile(content, name = "athletes.csv") {
  return {
    name,
    size: content.length,
    type: "text/csv",
    text: vi.fn().mockResolvedValue(content),
  };
}

function configureReads(existingEmails = ["existing@club.be"]) {
  mocks.from.mockImplementation((table) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({
        data: table === "users" ? existingEmails.map((email) => ({ email })) : [],
        error: null,
      })),
    })),
  }));
}

async function openImportModal() {
  const buttons = await screen.findAllByRole("button", { name: "Importer un CSV" });
  fireEvent.click(buttons[0]);
  return screen.findByRole("dialog", { name: "Importer des athlètes" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.clubId = 7;
  mocks.auth.profile = { id: 12, role: "head_coach", name: "Coach Nora" };
  configureReads();
  mocks.rpc.mockResolvedValue({
    data: { importedCount: 1, createdUserCount: 1 },
    error: null,
  });
});

afterEach(cleanup);

describe("intégration de l'import CSV dans AthleteList", () => {
  it("envoie uniquement les lignes valides au RPC et affiche ses deux compteurs", async () => {
    render(<AthleteList />);
    await openImportModal();

    const csv = [
      "Nom complet;Email;Âge;Discipline;Disciplines secondaires;Groupe;Niveau",
      "Profil existant;EXISTING@CLUB.BE;22;400 m;;Sprint;Régional",
      "Nora Dupont;nora@club.be;21;100 m;200 m | Relais;Sprint;National",
    ].join("\n");
    fireEvent.change(screen.getByLabelText("Fichier CSV à importer"), {
      target: { files: [makeCsvFile(csv)] },
    });

    expect(await screen.findByText("Nora Dupont")).toBeTruthy();
    expect(screen.getByText("1 ignorée")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Importer 1 athlète" }));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledOnce());
    expect(mocks.rpc).toHaveBeenCalledWith("import_club_athletes", {
      p_rows: [{
        name: "Nora Dupont",
        email: "nora@club.be",
        age: 21,
        mainDiscipline: "100 m",
        secondaryDisciplines: ["200 m", "Relais"],
        group: "Sprint",
        level: "National",
      }],
    });

    expect(await screen.findByText("1 athlète importé")).toBeTruthy();
    expect(screen.getByText(/1 profil a été relié à une adresse email/)).toBeTruthy();
    expect(screen.getByText(/1 ligne a été ignorée/)).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Importer des athlètes" })).toBeNull();
  });

  it("laisse le modal ouvert et montre l'erreur atomique renvoyée par le RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Ligne 1 : cet email est déjà utilisé." },
    });
    render(<AthleteList />);
    await openImportModal();

    const csv = "Nom complet;Email\nNora Dupont;nora@autre-club.be";
    fireEvent.change(screen.getByLabelText("Fichier CSV à importer"), {
      target: { files: [makeCsvFile(csv)] },
    });
    await screen.findByText("Nora Dupont");
    fireEvent.click(screen.getByRole("button", { name: "Importer 1 athlète" }));

    expect(await screen.findByText("Ligne 2 du CSV : cet email est déjà utilisé.")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Importer des athlètes" })).toBeTruthy();
    expect(screen.queryByText("1 athlète importé")).toBeNull();
  });

  it("ne propose pas une action que le RPC refuse à un coach ordinaire", async () => {
    mocks.auth.profile = { id: 13, role: "coach", name: "Coach adjoint" };
    render(<AthleteList />);

    expect(await screen.findByRole("heading", { name: "Athlètes" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Importer un CSV" })).toBeNull();
    expect(mocks.from.mock.calls.some(([table]) => table === "users")).toBe(false);
  });
});
