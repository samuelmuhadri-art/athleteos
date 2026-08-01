import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

/* global document */

const SCREENSHOT_DIR = resolve(process.cwd(), "docs/audit/screenshots");
const WIDTHS = [320, 360, 375, 390, 768, 1024, 1280, 1440];
const THEMES = ["dark", "light"];

mkdirSync(SCREENSHOT_DIR, { recursive: true });

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`auth ${theme} ${width}px sans débordement`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
      await page.addInitScript((value) => localStorage.setItem("athleteos-theme", value), theme);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Connecte-toi à ton espace" })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      for (const control of [page.getByLabel("Adresse email"), page.getByLabel("Mot de passe", { exact: true }), page.getByRole("button", { name: "Se connecter" })]) {
        const box = await control.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }

      await page.screenshot({
        path: resolve(SCREENSHOT_DIR, `auth-${theme}-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
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
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "auth-dark-zoom-200.png"), fullPage: true, animations: "disabled" });
});

test("inscription par invitation à 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/?invite=AB12CD34");
  await expect(page.getByLabel("Code d’invitation")).toHaveValue("AB12CD34");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "invitation-dark-320.png"), fullPage: true, animations: "disabled" });
});
