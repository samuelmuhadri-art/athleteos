import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ImportAthletesCsvModal from "./ImportAthletesCsvModal";

afterEach(cleanup);

function csvFile(name, content) {
  return {
    name,
    size: content.length,
    type: "text/csv",
    text: vi.fn().mockResolvedValue(content),
  };
}

describe("ImportAthletesCsvModal", () => {
  it("prévisualise les lignes valides puis les transmet explicitement à onImport", async () => {
    const onClose = vi.fn();
    const onImport = vi.fn().mockResolvedValue(undefined);
    const content = [
      "Nom complet;Email;Âge;Discipline;Groupe",
      "Nora Dupont;nora@club.be;21;100 m;Sprint",
      "Liam Martin;liam@club.be;19;Longueur;Sauts",
      "Email invalide;incorrect;20;400 m;Sprint",
    ].join("\n");

    render(<ImportAthletesCsvModal onClose={onClose} onImport={onImport} />);

    expect(screen.getByRole("dialog", { name: "Importer des athlètes" })).toBeTruthy();
    expect(screen.getByText(/CSV uniquement/)).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "Importer les athlètes" });
    expect(confirm.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Fichier CSV à importer"), {
      target: { files: [csvFile("athletes.csv", content)] },
    });

    expect(await screen.findByText("Nora Dupont")).toBeTruthy();
    expect(screen.getByText("Liam Martin")).toBeTruthy();
    expect(screen.getByText("1 ignorée")).toBeTruthy();
    expect(screen.getByText(/n'est pas valide/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Importer 2 athlètes" }));
    await waitFor(() => expect(onImport).toHaveBeenCalledOnce());
    expect(onImport).toHaveBeenCalledWith(
      [
        expect.objectContaining({ name: "Nora Dupont", email: "nora@club.be", speed: 50 }),
        expect.objectContaining({ name: "Liam Martin", email: "liam@club.be", group: "Sauts" }),
      ],
      expect.objectContaining({
        fileName: "athletes.csv",
        meta: expect.objectContaining({ validRows: 2, invalidRows: 1 }),
        skippedRows: [expect.objectContaining({ code: "invalid_email", row: 4 })],
        sourceRows: [2, 3],
      }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("refuse clairement un fichier Excel sans appeler onImport", async () => {
    const onImport = vi.fn();
    render(<ImportAthletesCsvModal onClose={vi.fn()} onImport={onImport} />);

    fireEvent.change(screen.getByLabelText("Fichier CSV à importer"), {
      target: { files: [csvFile("athletes.xlsx", "contenu") ] },
    });

    expect((await screen.findByRole("alert")).textContent).toMatch(/pas un fichier Excel .xlsx/i);
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Importer les athlètes" }).disabled).toBe(true);
  });

  it("ferme avec Échap uniquement lorsqu'aucun import n'est en cours", () => {
    const onClose = vi.fn();
    render(<ImportAthletesCsvModal onClose={onClose} onImport={vi.fn()} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
