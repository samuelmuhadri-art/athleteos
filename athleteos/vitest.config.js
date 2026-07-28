import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Config Vitest séparée de vite.config.js — le plugin PWA (injectManifest,
// écrit dans public/) n'a rien à faire pendant les tests et complique la
// config sans bénéfice.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{js,jsx}'],
    // Seuil de couverture PROGRESSIF (tâche 19) : pas un pourcentage global
    // artificiel (qui serait soit trivialement bas vu la taille de l'app,
    // soit rouge dès le premier commit) — un seuil élevé seulement sur les
    // modules qu'on a déjà choisi de couvrir. Un nouveau module testé =
    // une nouvelle ligne ici, le seuil grandit avec la couverture réelle.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/athlete/shared.js',
        'src/domain/disciplines.js',
        'src/utils/loadAxes.js',
        'src/utils/trainingLoad.js',
      ],
      // Seuils fixés SOUS la couverture réelle mesurée au moment de l'écriture
      // (statements 68.65/branches 55.13/functions 65.93/lines 77.03, mesurés
      // le 2026-08-02) — un plancher, pas un objectif atteint par hasard. Ne
      // JAMAIS baisser ces chiffres pour faire passer une régression ; les
      // monter au fur et à mesure que ces fichiers gagnent des tests.
      thresholds: {
        statements: 65,
        branches: 50,
        functions: 60,
        lines: 75,
      },
    },
  },
})
