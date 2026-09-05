/* global document, window -- utilisés uniquement dans les callbacks exécutés par Playwright dans le navigateur */
import assert from 'node:assert/strict';
import console from 'node:console';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from '@playwright/test';

const preview = new URL('./logo-preview.html', import.meta.url).href;
const output = new URL('../../test-results/brand-preview/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.route('http://**/*', route => route.abort());
    await page.goto(preview);
    assert.equal(await page.getByRole('button', { name: 'B — Piste', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.ok(await page.locator('[data-preview]').evaluateAll(images => images.every(img => img.src.endsWith('piste-v3.svg'))));
    for (const [concept, name] of [['elan', 'A — Élan'], ['piste', 'B — Piste'], ['relais', 'C — Relais']]) {
      const button = page.getByRole('button', { name, exact: true });
      await button.focus();
      await page.keyboard.press('Enter');
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[aria-pressed="true"]').count(), 1);
      assert.ok((await page.getByRole('status').innerText()).startsWith(name));
      await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
      const filename = concept === 'piste' ? 'piste-v3.svg' : `${concept}-v2.svg`;
      assert.ok(await page.locator('[data-preview]').evaluateAll((images, selected) => images.every(img => img.src.endsWith(selected)), filename));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Débordement : ${viewport.width}px`);
      await page.screenshot({ path: fileURLToPath(new URL(`${concept}-${viewport.width}.png`, output)), fullPage: true, animations: 'disabled' });
    }
    await page.goto(new URL('./piste-preview.html', import.meta.url).href);
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Débordement comparaison : ${viewport.width}px`);
    assert.equal(await page.locator('img[src="concepts/piste-v2.svg"]').count(), 1);
    assert.equal(await page.locator('img[src="concepts/piste-v3.svg"]').count(), 8);
    await page.screenshot({ path: fileURLToPath(new URL(`piste-refined-${viewport.width}.png`, output)), fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: "Voir cette version dans les maquettes d'interface." }).click();
    assert.equal(page.url(), preview);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`OK : sélection Piste, trois logos au clavier, comparaison avant/après, images et largeur ${viewport.width}px`);
  }
} finally {
  await browser.close();
}
