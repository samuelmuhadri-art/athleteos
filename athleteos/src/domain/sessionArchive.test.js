import { describe, expect, it } from "vitest";
import { getSessionArchiveCutoff, isSessionArchived } from "./sessionArchive";

const referenceDate = new Date(2026, 7, 10, 12);

describe("sessionArchive", () => {
  it("calcule la limite en dates locales", () => {
    expect(getSessionArchiveCutoff(referenceDate)).toBe("2026-08-03");
  });

  it("archive une séance vieille de sept jours", () => {
    expect(isSessionArchived({ sessionDate: "2026-08-03" }, referenceDate)).toBe(true);
  });

  it("conserve les six derniers jours dans le planning actif", () => {
    expect(isSessionArchived({ sessionDate: "2026-08-04" }, referenceDate)).toBe(false);
  });

  it("conserve les séances sans date au lieu de les perdre", () => {
    expect(isSessionArchived({}, referenceDate)).toBe(false);
  });
});
