# AthleteOS — guide Supabase (développement local, liaison, déploiement)

Ce guide explique comment travailler sur la base de données AthleteOS sans jamais toucher directement à la production, et comment déployer les changements une fois prêts. Écrit dans le cadre de la tâche 5 ("rendre Supabase reproductible depuis zéro").

## 1. Démarrer une base locale (recommandé pour tout développement)

Prérequis : [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et lancé (le CLI Supabase démarre les services Postgres/Auth/Storage/etc. dans des conteneurs).

```bash
cd athleteos
supabase start
```

La première fois, ça télécharge les images Docker (peut prendre quelques minutes) puis :
- applique **toutes** les migrations de `supabase/migrations/` dans l'ordre, à partir d'une base vide,
- charge `supabase/seed.sql` (deux clubs fictifs, tous les rôles, quelques séances/performances/blessures — voir le fichier pour le détail),
- affiche les URLs et clés à utiliser (voir étape 2).

Pour repartir d'une base neuve (efface tout, réapplique migrations + seed) :

```bash
supabase db reset
```

Pour arrêter :

```bash
supabase stop
```

## 2. Connecter le frontend à la base locale

```bash
supabase status -o env
```

affiche les identifiants locaux (`API_URL`, `ANON_KEY`, etc. — ce sont des clés de démonstration fixes, pas des secrets, les mêmes pour tout le monde sur toutes les instances locales). Mettez `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` dans votre `.env` local (voir `.env.example`) avec les valeurs `API_URL`/`ANON_KEY`, puis `npm run dev` comme d'habitude.

## 3. Créer un compte de test en local

Le seed (`supabase/seed.sql`) crée des lignes `users`/`athletes`/`clubs` fictives, mais **pas de compte de connexion réel** (recréer le mécanisme interne de mot de passe de Supabase Auth à la main est fragile et propre à chaque version — pas fait ici, voir `status.md`, tâche 5).

Pour vous connecter en local :
1. Ouvrez Supabase Studio (démarré par `supabase start`, en général http://127.0.0.1:54323).
2. Authentication → Add user → créez un compte avec un email/mot de passe de votre choix, confirmez l'email directement dans le formulaire.
3. Notez l'UUID du compte créé (colonne `id` dans la liste des utilisateurs).
4. Reliez-le à une des lignes de démo du seed (ex: le head coach du club A) :
   ```sql
   update public.users set auth_uid = '<uuid copié à l'étape 3>'
   where email = 'demo-head-coach@athleteos.local';
   ```
   (SQL Editor de Studio, ou `psql` sur `DB_URL` donné par `supabase status`.)
5. Connectez-vous dans l'app avec l'email/mot de passe créés à l'étape 2 — vous arrivez sur le compte head coach du club de démo.

## 4. Lancer la suite de tests RLS en local

```bash
supabase status -o env | sed 's/"//g' | grep -E '^[A-Z_]+=' > /tmp/supa.env
export $(cat /tmp/supa.env | xargs)
node test_rls_regression.mjs
```

(C'est exactement ce que fait `.github/workflows/rls-check.yml` en CI — voir ce fichier pour la version pas-à-pas.)

## 5. Régénérer les types TypeScript du schéma

Le projet est en JavaScript pur (pas de TypeScript, aucun `tsconfig.json`) — le fichier généré (`src/types/database.types.ts`) sert de référence/autocomplétion IDE via JSDoc (`@type {import('./types/database.types').Database}`), pas à une étape de build. À régénérer après tout changement de schéma :

```bash
# Depuis le schéma distant (production) — ne nécessite pas Docker :
supabase gen types typescript --linked --schema public > src/types/database.types.ts

# Depuis une base locale démarrée (supabase start) :
supabase gen types typescript --local --schema public > src/types/database.types.ts
```

## 6. Lier ce dossier à un projet Supabase distant

Déjà fait pour ce dépôt (`supabase/.temp/project-ref`, non versionné). Pour relier un nouveau clone :

```bash
supabase login
supabase link --project-ref kuqafsmkwajeipzolbky
```

## 7. Déployer — ce que `git push` fait et ne fait PAS

**`git push` sur `main` ne déploie QUE le frontend** (Vercel redéploie automatiquement). Les migrations SQL et les Edge Functions sont des étapes **manuelles séparées**, jamais déclenchées par git :

```bash
# Appliquer les migrations SQL en attente à la vraie base :
supabase db push

# Déployer une Edge Function modifiée :
supabase functions deploy <nom-de-la-fonction>
```

Toujours créer une **nouvelle** migration plutôt que modifier un fichier déjà appliqué (`supabase migration new <nom>`), et ne jamais lancer `db push`/`functions deploy` sans le demander explicitement — voir les règles du projet.

## 8. CI

`.github/workflows/rls-check.yml` reconstruit une base Supabase locale et jetable à chaque push/PR sur `main` (mêmes étapes que la section 1 ci-dessus, en automatique) et lance la suite RLS deux fois de suite contre elle. Ne touche jamais la production — c'est le test qui valide que ce guide fonctionne réellement, pas seulement en théorie.
