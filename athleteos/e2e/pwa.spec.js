import { expect, test } from "@playwright/test";

test("le manifeste installable et le service worker restent cohérents", async ({ page }) => {
  await page.goto("/");
  const manifest = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifest).toBeTruthy();

  const manifestResponse = await page.request.get(manifest);
  expect(manifestResponse.ok()).toBe(true);
  const payload = await manifestResponse.json();
  expect(payload.name).toBe("AthleteOS");
  expect(payload.display).toBe("standalone");
  expect(payload.start_url).toBe("/");
  expect(payload.icons.some(icon => icon.sizes === "512x512")).toBe(true);

  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service Worker indisponible");
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Connecte-toi à ton espace" })).toBeVisible();
});

test("le shell public se recharge hors connexion après installation du cache", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Connecte-toi à ton espace" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
