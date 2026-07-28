import { describe, expect, it } from "vitest";
import { getPasswordStrength, translateAuthError } from "./authFormUtils";

describe("authFormUtils", () => {
  it("traduit les erreurs Supabase connues sans masquer un message métier", () => {
    expect(translateAuthError({ message: "Invalid login credentials" })).toBe("Email ou mot de passe incorrect.");
    expect(translateAuthError({ message: "Club introuvable." })).toBe("Club introuvable.");
    expect(translateAuthError(null)).toMatch(/Une erreur est survenue/);
  });

  it("mesure la robustesse sans imposer de nouvelle règle serveur", () => {
    expect(getPasswordStrength("").score).toBe(0);
    expect(getPasswordStrength("court").score).toBe(1);
    expect(getPasswordStrength("athleteos").score).toBe(1);
    expect(getPasswordStrength("AthleteOS2026!").score).toBe(4);
  });
});
