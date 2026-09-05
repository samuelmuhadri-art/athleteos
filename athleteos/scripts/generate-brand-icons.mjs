import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from '@playwright/test';

// Rasterisation locale des SVG natifs, sans réseau ni service d'image externe.
const publicDir = new URL('../public/', import.meta.url);
const check = process.argv.includes('--check');
const browser = await chromium.launch();
try {
  for (const name of ['icon', 'icon-maskable']) {
    const svg = await readFile(new URL(`${name}.svg`, publicDir), 'utf8');
    for (const size of [192, 512]) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.route('**/*', route => route.abort());
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block}</style>${svg}`);
      const output = new URL(`${name}-${size}.png`, publicDir);
      const bytes = await page.screenshot({ type: 'png', ...(check ? {} : { path: fileURLToPath(output) }) });
      assert.equal(bytes.readUInt32BE(16), size);
      assert.equal(bytes.readUInt32BE(20), size);
      if (check) assert.deepEqual(bytes, await readFile(output), `${name}-${size}.png doit être régénéré`);
      console.log(`${check ? 'Vérifié' : 'Généré'} : ${name}-${size}.png`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
