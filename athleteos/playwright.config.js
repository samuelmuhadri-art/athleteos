import { defineConfig, devices } from '@playwright/test'

// Tâche 19 — E2E des parcours critiques coach/athlète.
//
// webServer démarre `vite preview` sur le build de production (pas le
// serveur de dev — plus proche de ce qui tourne réellement, et plus
// rapide à booter en CI). Les specs authentifiées (coach-journey,
// athlete-journey) ont besoin d'un Supabase LOCAL avec 2 comptes créés
// par e2e/global-setup.mjs — jamais la production (voir ce fichier pour
// le détail). smoke.spec.js, lui, ne nécessite aucune authentification
// et peut tourner contre n'importe quel Supabase configuré (y compris en
// local sur cette machine, sans Docker).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: process.env.E2E_WITH_AUTH ? './e2e/global-setup.mjs' : undefined,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // --host 127.0.0.1 explicite : `vite preview` par défaut bind sur
    // "localhost", qui peut résoudre en IPv6 (::1) selon l'environnement
    // — le health-check de Playwright sur 127.0.0.1 timeoutait alors que
    // le serveur tournait bel et bien (vérifié en local pendant
    // l'installation, tâche 19 : `curl http://127.0.0.1:4173/` échouait
    // tant que le serveur restait sur son host par défaut).
    command: 'npm run preview -- --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
})
