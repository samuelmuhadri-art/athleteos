import { describe, expect, it } from "vitest";
import {
  buildClubSetupSteps,
  buildInviteUrl,
  normalizeInviteCode,
  darkenHex,
  getClubSetupProgress,
  getClubThemeVariables,
  normalizeClubAccent,
} from "./clubBranding";

describe("clubBranding", () => {
  it("conserve uniquement une couleur hexadécimale sûre", () => {
    expect(normalizeClubAccent("#378add")).toBe("#378ADD");
    expect(normalizeClubAccent("red")).toBe("#1D9E75");
    expect(normalizeClubAccent("url(javascript:bad)")).toBe("#1D9E75");
  });

  it("produit les variables de thème dérivées", () => {
    expect(getClubThemeVariables("#378ADD")).toMatchObject({
      "--color-accent": "#378ADD",
      "--club-accent-rgb": "55, 138, 221",
      "--c-accent-light": "rgba(55, 138, 221, 0.15)",
    });
    expect(darkenHex("#FFFFFF", 0.2)).toBe("#CCCCCC");
  });

  it("construit un lien d’invitation sans modifier l’origine", () => {
    expect(buildInviteUrl(" ab12cd34 ", "https://app.athleteos.test")).toBe(
      "https://app.athleteos.test/?invite=AB12CD34",
    );
  });

  it("calcule une progression réelle en cinq étapes", () => {
    const steps = buildClubSetupSteps({
      club: { name: "Club ami", logoPath: null },
      athleteCount: 2,
      sessionCount: 0,
    });
    expect(steps.map((step) => step.complete)).toEqual([false, true, true, false, true]);
    expect(getClubSetupProgress(steps)).toBe(60);
  });
});

describe("normalizeInviteCode", () => {
  it("accepte les anciens caractères et retire les séparateurs de copie", () => {
    expect(normalizeInviteCode(" 0ilO-12a3 ")).toBe("0ILO12A3");
  });
});
