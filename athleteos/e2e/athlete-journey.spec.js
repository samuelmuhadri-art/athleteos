// ============================================================
// AthleteOS — e2e/athlete-journey.spec.js
//
// Parcours critique athlète : connexion -> Tableau de bord -> navigation
// vers Mon planning. Même limite que coach-journey.spec.js : nécessite
// e2e/global-setup.mjs (Supabase local, job CI dédié E2E_WITH_AUTH),
// jamais exécuté en local sur cette machine (pas de Docker) — voir le
// rapport de la tâche 19.
// ============================================================

import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const fixturesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), ".auth-fixtures.json");
test.skip(!existsSync(fixturesPath), "Nécessite e2e/global-setup.mjs (Supabase local, E2E_WITH_AUTH=1) — voir le commentaire en tête de fichier.");
const fixtures = existsSync(fixturesPath) ? JSON.parse(readFileSync(fixturesPath, "utf8")) : null;

async function login(page, email, password) {
  await page.goto("/");
  await page.getByPlaceholder("coach@club.be").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("l'athlète se connecte et voit son Tableau de bord", async ({ page }) => {
  await login(page, fixtures.athlete.email, fixtures.athlete.password);
  await expect(page.getByText("Tableau de bord")).toBeVisible({ timeout: 15000 });
});

test("l'athlète navigue vers son planning", async ({ page }) => {
  await login(page, fixtures.athlete.email, fixtures.athlete.password);
  await expect(page.getByText("Tableau de bord")).toBeVisible({ timeout: 15000 });
  await page.getByText("Planning", { exact: true }).click();
  await expect(page.getByText("Mon planning")).toBeVisible({ timeout: 10000 });
});
