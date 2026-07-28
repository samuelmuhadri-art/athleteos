import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

// Flat config ESLint (tâche 19) — premier lint jamais installé sur ce
// projet. Volontairement PAS en mode "zéro warning strict partout" :
// une base de code de cette taille, jamais lintée, ferait remonter des
// centaines d'avertissements de style sans rapport avec des bugs réels.
// On active les règles qui attrapent de VRAIS bugs (hooks mal utilisés,
// variables non définies, etc.), pas des préférences stylistiques.
export default [
  {
    // public/sw.js : template source du service worker (vite-plugin-pwa,
    // injectManifest) — tourne dans le scope global SW (`self`, `caches`),
    // pas le navigateur ; hors du périmètre applicatif linté ci-dessous.
    ignores: ['dist/**', 'node_modules/**', 'src/types/**', 'public/sw.js'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Seulement les 2 règles "classiques" (bugs réels : hook appelé de
      // façon conditionnelle, dépendances manquantes) — PAS le reste du
      // preset recommended-latest, qui embarque maintenant les règles du
      // React Compiler (set-state-in-effect, purity, etc.) : un style très
      // différent de celui déjà utilisé PARTOUT dans cette base de code
      // (ex: `useEffect(() => { fetchAll(); }, [fetchAll])`, présent dans
      // quasiment chaque module). Les activer ferait remonter ~50 erreurs
      // sur un pattern déjà établi — un changement d'architecture, pas un
      // lint, hors de portée d'une tâche d'installation.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['*.config.js', 'test_*.mjs', 'e2e/**/*.{js,mjs}', 'postcss.config.js', 'tailwind.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node } },
  },
]
