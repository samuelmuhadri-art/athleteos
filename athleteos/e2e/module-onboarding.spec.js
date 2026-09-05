import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const fixturesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), ".auth-fixtures.json");
test.skip(!existsSync(fixturesPath), "Nécessite Supabase local et E2E_WITH_AUTH=1.");
const fixtures = existsSync(fixturesPath) ? JSON.parse(readFileSync(fixturesPath, "utf8")) : null;

test("le head coach choisit un socle essentiel et obtient une navigation cohérente", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("coach@club.be").fill(fixtures.onboarding.coach.email);
  await page.getByPlaceholder("••••••••").fill(fixtures.onboarding.coach.password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Quels outils veux-tu utiliser ?" })).toBeVisible({ timeout: 15000 });
  await dialog.getByRole("button", { name: /^Essentiel/ }).click();
  await expect(dialog.getByRole("button", { name: "Continuer" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Terminer" }).click();
  await expect(dialog).toBeHidden({ timeout: 10000 });

  const sidebar = page.getByRole("complementary", { name: "Navigation coach desktop" });
  await expect(sidebar.getByRole("button", { name: "Planning", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Performances", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Messagerie", exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Charge", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: "Rapports", exact: true })).toHaveCount(0);
});
