import { expect, test } from '@playwright/test';
import { installUxFixture, loginUx } from './helpers/ux-fixture.js';
test.use({ serviceWorkers: 'block' });
for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test.describe(`correctifs ${viewport.width}px`, () => {
    test.use({ viewport });
    test('Retour ne repasse pas par une vue désactivée', async ({ page }) => {
      await installUxFixture(page, { keys: ['planning', 'messaging'] });
      await loginUx(page, '/planning');
      await expect(page.getByRole('button', { name: 'Nouvelle séance', exact: true })).toBeVisible();
      await page.evaluate(() => {
        globalThis.history.pushState({}, '', '/performances');
        globalThis.dispatchEvent(new globalThis.PopStateEvent('popstate'));
      });
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/planning$/);
      await expect(page.getByRole('button', { name: 'Nouvelle séance', exact: true })).toBeVisible();
    });
    test('un nouvel athlète ne reçoit aucune demande de permission automatique', async ({ page }) => {
      await page.addInitScript(() => {
        globalThis.__pushPermissionRequests = 0;
        globalThis.__pushRegistrations = 0;
        Object.defineProperty(globalThis, 'Notification', { configurable: true, value: {
          permission: 'default', requestPermission: async () => { globalThis.__pushPermissionRequests += 1; return 'denied'; },
        } });
        Object.defineProperty(globalThis, 'PushManager', { configurable: true, value: function PushManager() {} });
        globalThis.navigator.serviceWorker.register = async () => {
          globalThis.__pushRegistrations += 1;
          return { pushManager: { getSubscription: async () => null }, update: async () => {} };
        };
      });
      await installUxFixture(page, { role: 'athlete' });
      await loginUx(page);
      await expect(page.locator('#athlete-sidebar')).toBeAttached();
      await expect.poll(() => page.evaluate(() => globalThis.__pushRegistrations)).toBeGreaterThan(0);
      expect(await page.evaluate(() => globalThis.__pushPermissionRequests)).toBe(0);
      if (viewport.width < 768) await page.getByRole('button', { name: 'Notifications', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Activer les notifications', exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => globalThis.__pushPermissionRequests)).toBe(0);
    });
  });
}
