import { describe, expect, it, vi } from "vitest";
import { buildSessionDocumentDistribution, runDocumentUploadQueue } from "./documentLibrary";

describe("file d'upload documentaire", () => {
  it("upload chaque fichier exactement une fois avec une concurrence bornée", async () => {
    let active = 0;
    let maxActive = 0;
    const upload = vi.fn(async file => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return { id:file.id };
    });
    const files = Array.from({ length:12 }, (_, index) => ({ id:index + 1 }));
    const result = await runDocumentUploadQueue(files, { upload, concurrency:4 });
    expect(upload).toHaveBeenCalledTimes(12);
    expect(maxActive).toBeLessThanOrEqual(4);
    expect(result.every(entry => entry.status === "done")).toBe(true);
  });

  it("isole un échec pour permettre sa relance sans réuploader les succès", async () => {
    const upload = vi.fn(async file => {
      if (file.id === 2) throw new Error("réseau");
      return { id:file.id };
    });
    const result = await runDocumentUploadQueue([{ id:1 }, { id:2 }, { id:3 }], { upload, concurrency:3 });
    expect(result.map(entry => entry.status)).toEqual(["done", "error", "done"]);
    expect(result.filter(entry => entry.status === "error").map(entry => entry.file.id)).toEqual([2]);
  });
});

describe("distribution documentaire", () => {
  it("prépare en une fois des destinataires différents pour chaque document", () => {
    expect(buildSessionDocumentDistribution([
      { id:"11", visibility:"all", athleteIds:[1] },
      { id:12, visibility:"selected", athleteIds:[5, 3, 5] },
      { id:12, visibility:"selected", athleteIds:[3, 5] },
    ])).toEqual([
      { documentId:11, athleteIds:null },
      { documentId:12, athleteIds:[3, 5] },
    ]);
  });
});
