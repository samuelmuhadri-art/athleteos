// ============================================================
// AthleteOS — e2e/coach-journey.spec.js
//
// Parcours critique coach : connexion -> Dashboard -> navigation vers
// Planning et Athlètes. Nécessite un compte réel créé par
// e2e/global-setup.mjs (voir ce fichier) — tourne UNIQUEMENT contre un
// Supabase local (E2E_WITH_AUTH=1, job CI dédié), jamais vérifié en
// local sur cette machine (pas de Docker ici) — voir le rapport de la
// tâche 19 pour cette limite.
// ============================================================

import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const fixturesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), ".auth-fixtures.json");
// Skip proprement (pas de crash à l'import) quand global-setup.mjs n'a pas
// tourné — le cas normal en local sur cette machine, sans Docker/Supabase
// local disponible pour créer les comptes de test.
test.skip(!existsSync(fixturesPath), "Nécessite e2e/global-setup.mjs (Supabase local, E2E_WITH_AUTH=1) — voir le commentaire en tête de fichier.");
const fixtures = existsSync(fixturesPath) ? JSON.parse(readFileSync(fixturesPath, "utf8")) : null;

async function login(page, email, password) {
  await page.goto("/");
  await page.getByPlaceholder("coach@club.be").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("le coach se connecte et voit son Dashboard", async ({ page }) => {
  await login(page, fixtures.coach.email, fixtures.coach.password);
  await expect(page.getByText("Dashboard")).toBeVisible({ timeout: 15000 });
});

test("le coach navigue vers Planning", async ({ page }) => {
  await login(page, fixtures.coach.email, fixtures.coach.password);
  await expect(page.getByText("Dashboard")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Planning" }).click();
  await expect(page.getByRole("heading", { name: "Planning" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: "Ajouter" })).toBeVisible();
});

test("le coach navigue vers la liste des athlètes", async ({ page }) => {
  await login(page, fixtures.coach.email, fixtures.coach.password);
  await expect(page.getByText("Dashboard")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Athlètes" }).click();
  await expect(page.getByRole("heading", { name: "Athlètes" })).toBeVisible({ timeout: 10000 });
});

test("le code d'invitation du club est affichable", async ({ page }) => {
  await login(page, fixtures.coach.email, fixtures.coach.password);
  await expect(page.getByText("Dashboard")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Inviter" }).click();
  await expect(page.getByText("Inviter un athlète")).toBeVisible();
});
