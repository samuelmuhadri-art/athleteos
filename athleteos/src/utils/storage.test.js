import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSignedUrl, upload, from } = vi.hoisted(() => {
  const signedUrlMock = vi.fn();
  const uploadMock = vi.fn();
  return {
    createSignedUrl: signedUrlMock,
    upload: uploadMock,
    from: vi.fn(() => ({ createSignedUrl: signedUrlMock, upload: uploadMock })),
  };
});

vi.mock("./supabaseClient", () => ({
  supabase: { storage: { from } },
}));

import { openSessionAttachment, uploadSessionAttachment, validateSessionAttachment } from "./storage";

function fileFrom(content, name, type) {
  return new File([content], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateSessionAttachment", () => {
  it.each([
    ["un PDF", "%PDF-1.7\ncontent", "seance.pdf", "application/pdf"],
    ["une photo JPEG", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "photo.jpg", "image/jpeg"],
    ["un document Word", new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "plan.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["un CSV", "nom,charge\nAlice,12", "charge.csv", "text/csv"],
  ])("accepte %s valide", async (_label, content, name, type) => {
    await expect(validateSessionAttachment(fileFrom(content, name, type))).resolves.toBeNull();
  });

  it("refuse un faux PDF", async () => {
    await expect(validateSessionAttachment(fileFrom("<html>non</html>", "faux.pdf", "application/pdf")))
      .resolves.toMatch(/invalide ou corrompu/i);
  });

  it("refuse les exécutables", async () => {
    await expect(validateSessionAttachment(fileFrom("MZ", "virus.exe", "application/octet-stream")))
      .resolves.toMatch(/format non accepté/i);
  });
});

describe("uploadSessionAttachment", () => {
  it("préserve l'extension et envoie le Content-Type attendu", async () => {
    upload.mockResolvedValue({ error: null });
    const file = fileFrom(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "photo.jpg", "image/jpeg");
    const path = await uploadSessionAttachment("club-42", file);

    expect(path).toMatch(/^club-42\/.+\.jpg$/);
    expect(from).toHaveBeenCalledWith("session-pdfs");
    expect(upload).toHaveBeenCalledWith(path, file, { contentType: "image/jpeg" });
  });
});

describe("openSessionAttachment", () => {
  it("conserve l'onglet ouvert avant de demander l'URL signée", async () => {
    const popup = { opener: window, location: { replace: vi.fn() }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(popup);
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.test/file" }, error: null });

    await expect(openSessionAttachment("club-42/file.docx")).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(popup.opener).toBeNull();
    expect(popup.location.replace).toHaveBeenCalledWith("https://signed.test/file");
    open.mockRestore();
  });

  it("ferme l'onglet si la signature échoue", async () => {
    const popup = { opener: window, location: { replace: vi.fn() }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(popup);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    createSignedUrl.mockResolvedValue({ data: null, error: new Error("refusé") });

    await expect(openSessionAttachment("club-42/file.jpg")).resolves.toBe(false);
    expect(popup.close).toHaveBeenCalledOnce();
    open.mockRestore();
    consoleError.mockRestore();
  });
});
