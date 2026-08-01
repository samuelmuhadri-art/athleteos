# AthleteOS — guide du projet

AthleteOS est une PWA de suivi sportif destinée aux clubs, entraîneurs et athlètes. Le produit couvre notamment le planning, les réponses et charges de séance, le bien-être déclaré, les blessures signalées, les performances, compétitions, records, rapports, invitations, messagerie et notifications push.

Les indicateurs de charge, fatigue ou récupération sont des aides descriptives à la programmation. Ils ne constituent ni un diagnostic médical, ni une prédiction individuelle certaine.

## Stack

- React 19, Vite 8, JavaScript/JSX et Tailwind CSS 3 ;
- Supabase Auth, PostgreSQL, RLS, Storage, RPC et Edge Functions Deno ;
- Vitest, React Testing Library, Playwright, ESLint et typecheck TypeScript progressif ;
- PWA `injectManifest`, notifications Web Push, Vercel et GitHub Actions.

Le routage reste volontairement léger avec la History API (`useUrlView`) ; le projet n’utilise ni React Router, ni Next.js.

## Prérequis

- Node.js 22 ou version compatible plus récente ;
- npm 11 ou version compatible ;
- Docker Desktop pour Supabase local et les tests de base ;
- CLI Supabase 2.x ;
- Chromium Playwright pour les E2E.

## Installation

```bash
npm ci
Copy-Item .env.example .env   # PowerShell
# ou : cp .env.example .env
npm run dev
```

`npm ci` exige qu’aucun serveur Vite n’utilise les binaires de `node_modules` sous Windows. Arrêter les anciens `npm run dev`/`preview` en cas d’erreur `EPERM` sur Rolldown.

## Variables d’environnement

Copier `.env.example` vers `.env`. Les variables `VITE_*` sont intégrées au bundle et sont donc publiques.

| Variable frontend | Usage |
|---|---|
| `VITE_SUPABASE_URL` | URL publique de l’API Supabase |
| `VITE_SUPABASE_ANON_KEY` | clé publique `anon`, protégée par les RLS |
| `VITE_VAPID_PUBLIC_KEY` | clé publique Web Push |
| `VITE_SENTRY_DSN` | DSN frontend optionnel |

Les secrets suivants restent exclusivement dans Supabase, la CI locale ou les secrets d’environnement serveur : `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` et tout secret SMTP. Ne jamais les préfixer par `VITE_`.

## Supabase local

```bash
supabase start
supabase status -o env
supabase db reset
```

Le reset recrée la base locale, applique toutes les migrations dans l’ordre et charge `supabase/seed.sql`. Il ne doit jamais être pointé vers la production. Pour arrêter les conteneurs :

```bash
supabase stop
```

Après une nouvelle migration validée localement :

```bash
supabase db reset
supabase gen types typescript --local --schema public > src/types/database.types.ts
```

Contrôler ensuite le diff des types générés. Ne jamais modifier une ancienne migration déjà appliquée : créer un nouveau fichier avec `supabase migration new nom_de_la_correction`.

## Commandes de qualité

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run test:e2e
```

Avec Supabase local démarré et ses variables exportées :

```bash
npm run test:rls
npm run test:integration
$env:E2E_WITH_AUTH='1'; npm run test:e2e   # PowerShell
# E2E_WITH_AUTH=1 npm run test:e2e         # bash
```

`npm run check` enchaîne lint, typecheck, couverture unitaire et build. La couverture affichée est ciblée sur les modules explicitement listés dans `vitest.config.js` ; elle ne représente pas tout le frontend.

## Organisation

```text
src/App.jsx                    shell entraîneur
src/AthleteApp.jsx             shell athlète
src/modules/                   fonctionnalités entraîneur
src/athlete/views/             fonctionnalités athlète
src/domain/                    règles métier et présentations
src/components/                composants partagés
src/utils/ et src/hooks/       utilitaires, notifications et hooks
supabase/migrations/           schéma, RLS, RPC et Storage versionnés
supabase/functions/            Edge Functions Deno
e2e/                           parcours Playwright
test_*.mjs                     intégrations Supabase locales
```

## CI

`.github/workflows/ci.yml` utilise Node 22, exécute `npm ci` puis `npm run check`, démarre une instance Supabase jetable, rejoue les RLS deux fois, exécute les intégrations, reconstruit avec les identifiants locaux et lance les E2E authentifiés. L’arrêt Supabase est exécuté avec `if: always()`.

La CI ne constitue pas un déploiement Supabase et ne doit contenir aucune URL ou clé de production.

## Déploiement

Le frontend est déployé par Vercel depuis `main`. Les redirections SPA et en-têtes HTTP sont configurés dans `vercel.json`.

Les migrations et Edge Functions sont déployées séparément et uniquement après validation explicite :

```bash
supabase db push
supabase functions deploy admin-actions
supabase functions deploy send-push
supabase functions deploy session-reminders
supabase functions deploy signup
supabase functions deploy weekly-cron
```

Ces commandes ciblent potentiellement un projet distant lié : ne jamais les lancer automatiquement, pendant un test, ou sans vérifier le projet Supabase actif. Les migrations nouvelles doivent être appliquées avant les Edge Functions qui les appellent.

## Production et données

- Ne jamais exécuter `db reset`, des fixtures ou des tests destructifs sur la production.
- Ne jamais journaliser le contenu sensible des messages, blessures ou notifications.
- Les fichiers PDF de séance restent dans un bucket privé et s’ouvrent par URL signée.
- Les accès inter-clubs doivent être protégés côté RLS/RPC, jamais uniquement par un bouton masqué.
- Toute évolution des indicateurs scientifiques doit conserver un langage prudent et sa version de modèle.

## Propriété intellectuelle

AthleteOS est conçu et développé par **Samuel Muhadri**.

**Tous droits réservés © 2026 Samuel Muhadri.** Ce dépôt est publié pour présentation de portfolio, évaluation académique et référencement. Toute copie, modification, redistribution ou exploitation commerciale non autorisée est interdite.
