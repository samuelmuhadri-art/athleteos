// ============================================================
// AthleteOS — e2e/smoke.spec.js
//
// Parcours le plus critique de tous : l'app démarre et affiche l'écran
// de connexion. Aucune authentification requise — tourne contre
// n'importe quel Supabase configuré (local ou prod), y compris sans
// Docker (vérifié en local pendant l'installation, tâche 19).
// ============================================================

import { test, expect } from "@playwright/test";

test("l'app démarre et affiche l'écran de connexion", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AthleteOS" })).toBeVisible();
  await expect(page.getByPlaceholder("coach@club.be")).toBeVisible();
  await expect(page.getByPlaceholder("••••••••")).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
});

test("le lien vers l'inscription est visible et navigue", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Pas encore de compte ?").click();
  // SignupPage : pas d'auth nécessaire pour vérifier qu'elle s'affiche.
  await expect(page.getByPlaceholder("coach@club.be")).toBeHidden();
});

test("un identifiant invalide affiche une erreur, ne fait pas planter l'app", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("coach@club.be").fill("inexistant@example.invalid");
  await page.getByPlaceholder("••••••••").fill("mot-de-passe-invalide");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible({ timeout: 10000 });
});
