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
  await expect(page.getByRole("heading", { name: "Connecte-toi à ton espace" })).toBeVisible();
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

test.describe("authentification mobile", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("les champs restent lisibles, tactiles et sans débordement", async ({ page }) => {
    await page.goto("/");
    const email = page.getByLabel("Adresse email");
    const password = page.getByLabel("Mot de passe", { exact: true });

    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    expect((await email.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect((await password.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.document.documentElement.clientWidth)).toBe(true);

    await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
    await expect(password).toHaveAttribute("type", "text");
  });

  test("le choix Coach ou Athlète précède le formulaire d'inscription", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Pas encore de compte ?").click();
    await expect(page.getByRole("button", { name: /Coach.*Créer mon club/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /Athlète.*Rejoindre mon club/ }).click();
    await expect(page.getByLabel("Code d’invitation")).toBeVisible();
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.document.documentElement.clientWidth)).toBe(true);
  });
});

test.describe("contrat responsive du shell coach", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("la barre latérale reste cachée sur mobile et revient sur desktop", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const sidebar = globalThis.document.createElement("aside");
      sidebar.id = "coach-sidebar";
      sidebar.className = "hidden md:flex flex-col sidebar-premium";
      sidebar.setAttribute("aria-label", "Navigation coach desktop");
      sidebar.style.width = "224px";
      sidebar.style.height = "200px";
      globalThis.document.body.append(sidebar);
    });

    const sidebar = page.getByRole("complementary", { name: "Navigation coach desktop" });
    await expect(sidebar).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(sidebar).toBeVisible();
  });
});
