import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Un seul manifeste source : public/manifest.json. VitePWA génère ensuite
// manifest.webmanifest à partir de cette même définition, sans duplication
// manuelle susceptible de diverger.
const pwaManifest = JSON.parse(
  readFileSync(new URL('./public/manifest.json', import.meta.url), 'utf8'),
)

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      manifest: pwaManifest,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
})
