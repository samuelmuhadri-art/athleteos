/* global document, window, Node */
import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const fixturesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), ".auth-fixtures.json");
test.skip(!existsSync(fixturesPath), "Nécessite Supabase local et E2E_WITH_AUTH=1.");
const fixtures = existsSync(fixturesPath) ? JSON.parse(readFileSync(fixturesPath, "utf8")) : null;

async function login(page, account) {
  await page.goto("/");
  await page.getByPlaceholder("coach@club.be").fill(account.email);
  await page.getByPlaceholder("••••••••").fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeHidden({ timeout: 15000 });
}

async function openAthletes(page) {
  await page.getByRole("complementary", { name: "Navigation coach desktop" })
    .getByRole("button", { name: "Athlètes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Athlètes" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Chargement des athlètes…", { exact: true })).toBeHidden({ timeout: 15000 });
}

test.describe.serial("UX prioritaire des outils", () => {
  test("le niveau club possède un accès Réglages → Outils évident", async ({ page }) => {
    await login(page, fixtures.ux.coach);
    await page.getByRole("button", { name: "Ouvrir les réglages" }).click();
    const dialog = page.getByRole("dialog", { name: "Réglages" });
    await dialog.getByRole("tab", { name: "Outils" }).click();
    await expect(dialog.getByRole("heading", { name: "Outils AthleteOS" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Outils du club" })).toBeVisible();
    await expect(
      dialog.getByText(/Choisis les outils que tu souhaites utiliser avec ton groupe/, { exact: false }).first(),
    ).toBeVisible();
  });

  test("Antonin se configure depuis sa carte et sa fiche en quelques interactions", async ({ page }) => {
    await login(page, fixtures.ux.coach);
    await openAthletes(page);
    await expect(page.getByRole("button", { name: "Configurer les outils" })).toBeVisible();
    await page.getByRole("button", { name: "Configurer les outils" }).click();
    const dialog = page.getByRole("dialog", { name: "Personnaliser le suivi" });
    await expect(dialog.getByText("Ce que Antonin voit dans AthleteOS.")).toBeVisible();
    await dialog.getByRole("button", { name: /^Essentiel/ }).click();
    await expect(dialog.locator(".module-preset-status")).toHaveText("Essentiel");
    await dialog.getByLabel("Badges et progression : désactivé").click();
    await expect(dialog.locator(".module-preset-status")).toHaveText("Personnalisé");
    await dialog.getByRole("button", { name: "Appliquer" }).click();
    await expect(dialog).toBeHidden({ timeout: 10000 });
    await expect(page.getByText("Planning · Performances · Messagerie · Badges")).toBeVisible();

    await page.getByRole("button", { name: /Ouvrir le profil de Antonin/ }).click();
    await expect(page.getByRole("button", { name: "Outils actifs" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Configurer" })).toBeVisible();
  });

  test("le dashboard donne la priorité au planning et garde compétition, message et badges", async ({ page }) => {
    await login(page, fixtures.ux.athlete);
    await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Sprint — vitesse max").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Voir ma séance" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ma semaine" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Meeting de Bruxelles" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /a envoyé un message/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Voir la progression et les badges" })).toBeVisible();
    await expect(page.getByText(/Progression · \d+ badge/)).toBeVisible();
    await expect(page.getByText("Premier pas", { exact: true })).toHaveCount(0);
    const order = await page.evaluate(() => {
      const today = [...document.querySelectorAll("h2")].find((node) => node.textContent === "Aujourd’hui");
      const week = [...document.querySelectorAll("h2")].find((node) => node.textContent === "Ma semaine");
      const progression = [...document.querySelectorAll("h2")].find((node) => node.textContent === "Ta progression");
      return Boolean(today && week && progression
        && today.compareDocumentPosition(week) & Node.DOCUMENT_POSITION_FOLLOWING
        && week.compareDocumentPosition(progression) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
  });

  test("Badges OFF les retire sans toucher à l’historique", async ({ page }) => {
    await login(page, fixtures.ux.coach);
    await openAthletes(page);
    await page.getByRole("button", { name: "Configurer les outils" }).click();
    const dialog = page.getByRole("dialog", { name: "Personnaliser le suivi" });
    await dialog.getByLabel("Badges et progression : activé").click();
    await dialog.getByRole("button", { name: "Appliquer" }).click();
    await expect(dialog).toBeHidden({ timeout: 10000 });

    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await login(page, fixtures.ux.athlete);
    await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "Voir la progression et les badges" })).toHaveCount(0);
    await expect(page.getByText(/Progression · \d+ badge/)).toHaveCount(0);
  });

  test("le parcours outil → athlètes réactive les badges et restaure la progression", async ({ page }) => {
    await login(page, fixtures.ux.coach);
    await openAthletes(page);
    await page.getByRole("button", { name: "Gérer les outils" }).click();
    const dialog = page.getByRole("dialog", { name: "Personnaliser le suivi" });
    await dialog.getByRole("tab", { name: "Par outil" }).click();
    await dialog.getByRole("button", { name: /Badges et progression\s*0\/1/ }).click();
    await dialog.getByRole("checkbox", { name: /Antonin Leroy/ }).check();
    await dialog.getByRole("button", { name: "Appliquer" }).click();
    await expect(dialog).toBeHidden({ timeout: 10000 });

    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await login(page, fixtures.ux.athlete);
    await expect(page.getByRole("button", { name: "Voir la progression et les badges" })).toBeVisible({ timeout: 15000 });
  });

  test("le haut du dashboard reste propre à 375, 390 et 430 px", async ({ page }) => {
    await login(page, fixtures.ux.athlete);
    await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toBeVisible({ timeout: 15000 });
    for (const width of [375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      const today = page.getByRole("heading", { name: "Aujourd’hui" });
      const week = page.getByRole("heading", { name: "Ma semaine" });
      await expect(today).toBeVisible({ timeout: 15000 });
      await expect(week).toBeVisible();
      const [todayBox, weekBox] = await Promise.all([today.boundingBox(), week.boundingBox()]);
      expect(todayBox.y).toBeLessThan(weekBox.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
});
