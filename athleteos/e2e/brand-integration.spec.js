import { expect, test } from '@playwright/test';
import { installUxFixture, loginUx } from './helpers/ux-fixture.js';

test.use({ serviceWorkers: 'block' });
for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test.describe(`marque ${viewport.width}px`, () => {
    test.use({ viewport });
    for (const role of ['head_coach', 'athlete']) {
      test(`piste validée à la connexion et dans l'espace ${role}`, async ({ page }, testInfo) => {
        await installUxFixture(page, { role });
        await page.goto('/');
        // Les déclinaisons desktop/mobile coexistent dans le DOM : vérifier celle affichée.
        const track = page.locator('svg:visible g[transform="rotate(-28 32 32)"]');
        await expect(track.first()).toBeVisible();
        await expect(track.first().locator('rect')).toHaveCount(2);
        await expect(track.first().locator('path')).toHaveAttribute('d', 'M36 16v8');
        await page.screenshot({ path: testInfo.outputPath('login.png'), animations: 'disabled' });
        await loginUx(page);
        await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeHidden();
        // Attendre le shell réel, pas le logo temporaire de l'écran de chargement.
        await expect(page.locator(role === 'athlete' ? '#athlete-sidebar' : '#coach-sidebar')).toBeAttached();
        if (role === 'head_coach' && viewport.width < 768) {
          // Le coach mobile affiche le titre de page, pas de logo : préserver ce choix de navigation.
          await expect(page.getByRole('navigation', { name: 'Navigation coach', exact: true })).toBeVisible();
          await expect(page.locator('#coach-sidebar g[transform="rotate(-28 32 32)"] path')).toHaveAttribute('d', 'M36 16v8');
          await expect(page.locator('#coach-sidebar')).toBeHidden();
        } else {
          await expect(track.first()).toBeVisible();
        }
        await expect(page.locator('svg path[d="M48 16A23 23 0 1 0 54 32"]')).toHaveCount(0);
        expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('shell.png'), animations: 'disabled' });
      });
    }
  });
}
