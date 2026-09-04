/* global document, getComputedStyle, window */
import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const fixturesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), ".auth-fixtures.json");
test.skip(!existsSync(fixturesPath), "Nécessite Supabase local et E2E_WITH_AUTH=1.");
const fixtures = existsSync(fixturesPath) ? JSON.parse(readFileSync(fixturesPath, "utf8")) : null;

async function login(page, account) {
  await page.goto("/");
  await page.getByLabel("Adresse email").fill(account.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator(".app-main-scroll")).toBeVisible({ timeout: 15000 });
}

async function openMessages(page, width) {
  if (width < 768) {
    const navigation = page.getByRole("navigation", { name: "Navigation coach" });
    await navigation.getByRole("button", { name: /^Messages/ }).click();
  } else {
    await page.getByRole("complementary", { name: "Navigation coach desktop" })
      .getByRole("button", { name: "Messagerie", exact: true }).click();
  }
  await expect(page.getByText("Chargement de la messagerie…", { exact: true })).toBeHidden({ timeout: 15000 });
}

async function openCoachRoute(page, route, label, width) {
  if (width < 768) {
    const navigation = page.getByRole("navigation", { name: "Navigation coach" });
    await navigation.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  } else {
    await page.getByRole("complementary", { name: "Navigation coach desktop" })
      .getByRole("button", { name: label, exact: true }).click();
  }
  await expect(page).toHaveURL(new RegExp(`/${route}$`));
}

for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  test(`messagerie coach single-pane à ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page, fixtures.post.coach);
    await openMessages(page, viewport.width);

    await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();
    await expect(page.getByText("Sélectionnez une conversation", { exact: true })).toBeHidden();

    await page.getByRole("button", { name: /Antonin Leroy/ }).click();
    await expect(page.getByRole("heading", { name: "Conversations" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Retour aux conversations" })).toBeVisible();

    const input = page.getByPlaceholder(/Message à Antonin/);
    await input.fill(`Test responsive ${viewport.width}`);
    const send = page.getByRole("button", { name: "Envoyer le message" });
    await expect(send).toBeEnabled();

    if (viewport.width < 768) {
      const navigation = page.getByRole("navigation", { name: "Navigation coach" });
      const [inputBox, navigationBox] = await Promise.all([input.boundingBox(), navigation.boundingBox()]);
      expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(navigationBox.y);
    }

    await send.click();
    await expect(page.getByText(`Test responsive ${viewport.width}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Retour aux conversations" }).click();
    await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible();
  });
}

test("le modal de configuration reste opaque et cadré en light mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("athleteos-theme", "light"));
  await login(page, fixtures.post.coach);
  const navigation = page.getByRole("navigation", { name: "Navigation coach" });
  await navigation.getByRole("button", { name: /^Athlètes/ }).click();
  await expect(page.getByText("Chargement des athlètes…", { exact: true })).toBeHidden({ timeout: 15000 });
  await page.getByRole("button", { name: "Configurer les outils" }).click();

  const dialog = page.getByRole("dialog", { name: "Personnaliser le suivi" });
  await expect(dialog).toBeVisible();
  const geometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      background: getComputedStyle(element).backgroundColor,
      top: rect.top,
      bottom: window.innerHeight - rect.bottom,
      left: rect.left,
      right: window.innerWidth - rect.right,
    };
  });
  expect(geometry.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(geometry.top).toBeGreaterThanOrEqual(8);
  expect(geometry.left).toBeGreaterThanOrEqual(8);
  expect(geometry.right).toBeGreaterThanOrEqual(8);
  expect(geometry.bottom).toBeGreaterThanOrEqual(0);
});

test("la messagerie desktop donne la place principale à la conversation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, fixtures.post.coach);
  await openMessages(page, 1280);
  await page.getByRole("button", { name: /Antonin Leroy/ }).click();

  const list = page.locator("[data-conversation-list]");
  const thread = page.locator("[data-conversation-thread]");
  await expect(list).toBeVisible();
  await expect(thread).toBeVisible();
  await expect(page.getByRole("button", { name: "Retour aux conversations" })).toBeHidden();
  const [listBox, threadBox] = await Promise.all([list.boundingBox(), thread.boundingBox()]);
  expect(threadBox.width).toBeGreaterThan(listBox.width * 2);
});

test("le planning simplifie une équipe unique et combine correctement ses filtres", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, fixtures.post.coach);
  await openCoachRoute(page, "planning", "Planning", 390);
  await expect(page.getByText("Chargement du planning…", { exact: true })).toBeHidden({ timeout: 15000 });

  await expect(page.getByLabel("Filtrer par groupe")).toHaveCount(0);
  await expect(page.getByText("Équipe · Sprint", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Filtrer par athlète")).toHaveValue("all");
  await expect(page.getByLabel("Filtrer par athlète").locator("option").first()).toHaveText("Tous mes athlètes");
  await expect(page.getByText("Sprint — vitesse max", { exact: true })).toBeVisible();

  await page.getByLabel("Filtrer par discipline").selectOption("lancer");
  await expect(page.getByText("Sprint — vitesse max", { exact: true })).toBeHidden();
  await page.getByLabel("Filtrer par discipline").selectOption("sprint");
  await expect(page.getByText("Sprint — vitesse max", { exact: true })).toBeVisible();
});

test("les modales compétition et stage restent accessibles à 320×568", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("athleteos-theme", "light"));
  await login(page, fixtures.post.coach);
  await openCoachRoute(page, "planning", "Planning", 320);
  await expect(page.getByText("Chargement du planning…", { exact: true })).toBeHidden({ timeout: 15000 });

  await page.getByRole("button", { name: "Ajouter au planning", exact: true }).click();
  await page.getByRole("button", { name: "Compétition" }).click();
  const competition = page.getByRole("dialog", { name: "Créer une compétition" });
  await expect(competition).toBeVisible();
  await expect(competition.getByRole("button", { name: "Créer" })).toBeVisible();
  const competitionBox = await competition.boundingBox();
  expect(competitionBox.y).toBeGreaterThanOrEqual(8);
  expect(competitionBox.x).toBeGreaterThanOrEqual(8);
  expect(competitionBox.x + competitionBox.width).toBeLessThanOrEqual(312);
  await competition.getByRole("button", { name: "Fermer" }).click();

  await page.getByRole("button", { name: "Ajouter au planning", exact: true }).click();
  await page.getByRole("button", { name: "Stage, test ou autre" }).click();
  const eventDialog = page.getByRole("dialog", { name: "Ajouter" });
  await expect(eventDialog).toBeVisible();
  await expect(eventDialog.getByRole("button", { name: "Stage", exact: true })).toBeVisible();
  await expect(eventDialog.getByRole("button", { name: "Test", exact: true })).toBeVisible();
  await expect(eventDialog.getByRole("button", { name: "Enregistrer" })).toBeVisible();
  const eventGeometry = await eventDialog.evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    x: element.getBoundingClientRect().x,
    y: element.getBoundingClientRect().y,
  }));
  expect(eventGeometry.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(eventGeometry.x).toBeGreaterThanOrEqual(8);
  expect(eventGeometry.y).toBeGreaterThanOrEqual(8);
});

for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
  test(`dashboard coach non coupé par le dock à ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page, fixtures.post.coach);
    const main = page.getByRole("main");
    const objective = page.getByText("10 s 90", { exact: true });
    const navigation = page.getByRole("navigation", { name: "Navigation coach" });
    await expect(page.getByRole("heading", { name: "Objectifs saison" })).toBeVisible();
    await expect(objective).toBeVisible();
    await main.hover({ position: { x: 100, y: 200 } });
    await expect.poll(async () => {
      try {
        await page.mouse.wheel(0, 700);
        const [objectiveBox, navigationBox] = await Promise.all([objective.boundingBox(), navigation.boundingBox()]);
        return objectiveBox.y >= 64 && objectiveBox.y + objectiveBox.height <= navigationBox.y;
      } catch {
        return false;
      }
    }, { timeout: 10000 }).toBe(true);
    await expect(objective).toBeInViewport();
    const [objectiveBox, navigationBox, paddingBottom] = await Promise.all([
      objective.boundingBox(),
      navigation.boundingBox(),
      main.evaluate(element => Number.parseFloat(getComputedStyle(element).paddingBottom)),
    ]);
    expect(paddingBottom).toBeGreaterThanOrEqual(76);
    expect(objectiveBox.y + objectiveBox.height).toBeLessThanOrEqual(navigationBox.y);
  });
}

test("le dashboard athlète aligne la semaine, compacte les badges et évite le rouge compétition", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, fixtures.post.athlete);
  await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toBeVisible({ timeout: 15000 });
  const wellnessClose = page.getByRole("button", { name: "Fermer le questionnaire bien-être" });
  if (await wellnessClose.isVisible()) await wellnessClose.click();
  const week = page.locator(".athlete-week-overview");
  const container = page.locator(".page-container").first();
  const [weekBox, containerBox, containerPadding] = await Promise.all([
    week.boundingBox(),
    container.boundingBox(),
    container.evaluate(element => {
      const style = getComputedStyle(element);
      return { left: Number.parseFloat(style.paddingLeft), right: Number.parseFloat(style.paddingRight) };
    }),
  ]);
  expect(Math.abs(weekBox.x - (containerBox.x + containerPadding.left))).toBeLessThanOrEqual(1);
  expect(Math.abs((weekBox.x + weekBox.width) - (containerBox.x + containerBox.width - containerPadding.right))).toBeLessThanOrEqual(1);
  await expect(page.getByRole("button", { name: "Voir la progression et les badges" })).toBeVisible();
  await expect(page.getByText("Premier pas", { exact: true })).toHaveCount(0);

  const nextCompetition = page.getByRole("button", { name: /Meeting de Bruxelles/ });
  const background = await nextCompetition.evaluate(element => getComputedStyle(element).backgroundImage);
  expect(background).not.toMatch(/107, 23, 23|168, 37, 37/);

  const navigation = page.getByRole("navigation", { name: "Navigation athlète" });
  await navigation.getByRole("button", { name: /^Planning/ }).click();
  const tabs = page.getByRole("radiogroup", { name: "Affichage du planning" }).getByRole("radio");
  await expect(tabs).toHaveText(["Semaine", "Mois", "Liste", /Archives/]);
});

test("le shell coach ne déborde horizontalement sur aucune largeur cible", async ({ page }) => {
  const viewports = [
    { width: 320, height: 568 }, { width: 360, height: 800 },
    { width: 375, height: 812 }, { width: 390, height: 844 },
    { width: 430, height: 932 }, { width: 768, height: 1024 },
    { width: 820, height: 1180 }, { width: 1024, height: 768 },
    { width: 1280, height: 800 }, { width: 1440, height: 900 },
  ];
  await page.setViewportSize(viewports[0]);
  await login(page, fixtures.post.coach);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      mainClientWidth: document.querySelector("main")?.clientWidth ?? 0,
      mainScrollWidth: document.querySelector("main")?.scrollWidth ?? 0,
    }));
    expect(geometry.documentWidth, `${viewport.width}px : document`).toBeLessThanOrEqual(geometry.viewport + 1);
    expect(geometry.mainScrollWidth, `${viewport.width}px : contenu principal`).toBeLessThanOrEqual(geometry.mainClientWidth + 1);
  }
});
