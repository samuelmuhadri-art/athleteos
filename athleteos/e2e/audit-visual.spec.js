import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

/* global document */

const SCREENSHOT_DIR = resolve(process.cwd(), "docs/audit/screenshots");
const VIEWPORTS = [
  { width:1440, height:900 }, { width:1024, height:768 },
  { width:768, height:1024 }, { width:430, height:932 },
  { width:390, height:844 }, { width:375, height:812 },
  { width:360, height:800 }, { width:320, height:568 },
];
const THEMES = ["dark", "light"];

mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function saveAuditScreenshot(page, filename) {
  const screenshotPath = resolve(SCREENSHOT_DIR, filename);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      await page.waitForTimeout(250 * attempt);
    }
  }
}

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`auth ${theme} ${viewport.width}×${viewport.height} sans débordement`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((value) => localStorage.setItem("athleteos-theme", value), theme);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Connecte-toi à ton espace" })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      for (const control of [page.getByLabel("Adresse email"), page.getByLabel("Mot de passe", { exact: true }), page.getByRole("button", { name: "Se connecter" })]) {
        const box = await control.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }

      await saveAuditScreenshot(page, `auth-${theme}-${viewport.width}x${viewport.height}.png`);
    });
  }
}

test("auth reste utilisable avec un agrandissement à 200 %", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await expect(page.getByLabel("Adresse email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await saveAuditScreenshot(page, "auth-dark-zoom-200.png");
});

test("inscription par invitation à 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/?invite=AB12CD34");
  await expect(page.getByLabel("Code d’invitation")).toHaveValue("AB12CD34");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await saveAuditScreenshot(page, "invitation-dark-320.png");
});
