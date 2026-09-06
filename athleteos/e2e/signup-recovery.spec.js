import { expect, test } from '@playwright/test';
import { installUxFixture } from './helpers/ux-fixture.js';
test.use({ serviceWorkers: 'block' });
for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test.describe(`création club ${viewport.width}px`, () => {
    test.use({ viewport });
    async function signup(page) {
      await page.goto('/');
      await page.getByRole('button', { name: /Créer ou rejoindre un club/ }).click();
      await page.getByLabel('Nom du club').fill('Nouveau club');
      await page.getByLabel('Prénom et nom').fill('Coach Nouveau');
      await page.getByLabel('Adresse email').fill('new-club@example.invalid');
      await page.getByLabel('Mot de passe', { exact: true }).fill('Fixture-only-123!');
      await page.getByRole('button', { name: 'Créer mon club', exact: true }).click();
    }
    async function fixture(page) {
      await installUxFixture(page, { empty: true, configured: false });
      await page.route('**/functions/v1/signup', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }));
    }
    test('un nouveau coach arrive sur la configuration de son club', async ({ page }) => {
      await fixture(page); await signup(page);
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Vérification de la session…')).toHaveCount(0);
    });
    test('profil absent : erreur guidée, retry réussi, aucune recréation de compte', async ({ page }) => {
      await fixture(page);
      let missing = true, creations = 0;
      page.on('request', request => { if (new URL(request.url()).pathname === '/functions/v1/signup') creations += 1; });
      await page.route('**/rest/v1/users?**', route => {
        const url = new URL(route.request().url());
        if (missing && url.searchParams.has('auth_uid')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return route.fallback();
      });
      await signup(page);
      await expect(page.getByRole('alert')).toContainText('introuvable');
      await expect(page.getByText('Vérification de la session…')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Revenir à la connexion' })).toBeVisible();
      missing = false;
      await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(creations).toBe(1);
    });
    test('erreur 406 : la déconnexion reste accessible et revient au formulaire', async ({ page }) => {
      await fixture(page);
      await page.route('**/rest/v1/users?**', route => {
        if (new URL(route.request().url()).searchParams.has('auth_uid')) return route.fulfill({ status: 406, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object', details: 'Multiple rows' }) });
        return route.fallback();
      });
      await signup(page);
      await expect(page.getByRole('alert')).toContainText('Impossible de charger');
      await page.getByRole('button', { name: 'Revenir à la connexion' }).click();
      await expect(page.getByLabel('Adresse email')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
      await expect(page.getByText('Vérification de la session…')).toHaveCount(0);
    });
  });
}
