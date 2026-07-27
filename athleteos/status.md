# AthleteOS - état du chantier

## Tâches précédentes
- **Tâche 1** (nettoyage dépôt/secrets/CI) : terminée, commitée (`88b27d4`) et poussée sur `origin/main`. Détails dans l'historique git de ce fichier.

## Tâche active
- Numéro : 2
- Branche : main (aucune branche dédiée créée — travail effectué directement, non commité)
- Objectif : Sécuriser l'Edge Function `send-push` — empêcher tout appelant de faire envoyer une notification à des identifiants arbitraires ou à un autre club.
- Risques : La fonction utilise la clé `service_role` (contourne toute RLS) et n'avait aucune vérification d'appelant — n'importe qui connaissant l'URL de la fonction pouvait cibler n'importe quel `athlete_id`/`user_id` de n'importe quel club. Aucune preuve d'exploitation trouvée, mais c'est une escalade de privilèges directe.

## Décisions prises
- Authentification : JWT extrait du header `Authorization`, résolu vers `users(id, club_id, role)` via `auth_uid` — même pattern que `admin-actions/index.ts` (déjà en prod). Chemin cron préservé à l'identique : `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`, déjà utilisé par `weekly-cron/index.ts` (non modifié).
- Matrice d'autorisation, décidée après lecture de tous les appelants réels (`src/utils/notifications.js` et tous ses call sites) :
  - `athleteIds` : limité au club de l'appelant, **pour coach ET athlète**. J'avais d'abord bloqué tout `athleteIds` pour le rôle athlète (comme suggéré par l'énoncé de la tâche), mais la relecture du diff a montré que ça cassait 3 flux réels : auto-notification (récap hebdo déclenché depuis `AthleteApp.jsx`), messagerie inter-athlètes (`AthleteMsgerie.jsx` → `notifyAthleteMessage`), et diffusion d'un post du club à l'équipe (`AthleteClub.jsx` → `notifyClubNewPost`). La vraie frontière de sécurité ici est le club, pas le rôle.
  - `userIds` : coach/head_coach peuvent cibler n'importe quel user de leur club ; athlète limité aux coachs (`head_coach`/`coach`) de son club (aucun flux existant ne cible un autre athlète par ce vecteur).
  - Toute divergence entre IDs demandés et IDs résolus (club différent, rôle non autorisé, ID inexistant) → `403` explicite, pas de filtrage silencieux.
- Validation de contenu ajoutée : titre/corps/tag/url (longueur + `url` doit être un chemin relatif commençant par `/` — aucun usage existant n'envoie d'URL externe), taille brute du payload (20 ko) et nombre de destinataires (300) plafonnés → `400`/`413`.
- CORS restreint : liste d'origines par défaut incluant `https://athleteos-by-samuelmuhadri.vercel.app` (domaine de prod confirmé par vous) + ports Vite locaux, codée en dur dans `send-push/index.ts` (URL publique, pas un secret — pas besoin de config Supabase séparée). Reste surchargeable/complétable via la variable d'env `ALLOWED_ORIGINS` (secrets de la fonction) si un autre domaine doit être ajouté plus tard (custom domain, preview Vercel...), sans redéploiement de code.
- Pas de nouvelle migration : la fonction utilise déjà `service_role`, qui contourne RLS — toute la protection est en code applicatif. La policy RLS existante sur `push_subscriptions` (club-scoped, tâche de sécurité précédente) n'est pas affectée et reste correcte pour les accès directs du navigateur (insertion de sa propre subscription).
- Erreur 500 : ne renvoie plus `err.message` au client (uniquement en log serveur), pour éviter de fuiter des détails internes.

## Fichiers modifiés
- `supabase/functions/send-push/index.ts` (réécrit) : authentification, résolution serveur des destinataires par club/rôle, validation du payload, CORS restreint, journalisation sans contenu sensible. Logique métier d'envoi (web-push, nettoyage des abonnements morts) inchangée.
- `test_send_push_regression.mjs` (créé, racine `athleteos/`) : script de non-régression HTTP calqué sur `test_rls_regression.mjs` — crée 2 clubs, un coach, un athlète (avec compte de connexion) et un coéquipier, appelle la fonction déployée avec différents JWT/payloads, nettoie tout.
- `supabase/functions/weekly-cron/index.ts` : **non modifié** — son appel `Authorization: Bearer <service_role>` est le chemin serveur déjà attendu par la nouvelle logique.

## Vérifications exécutées
- [x] `npm run build` — succès (aucun changement côté frontend, vérifié quand même).
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo (cf. tâche 1).
- [ ] **`test_send_push_regression.mjs` — écrit mais PAS exécuté.** Nécessite que `send-push` soit déployée sur le projet Supabase (interdiction de déployer dans cette tâche) et des secrets Supabase live que je n'ai pas et ne dois pas manipuler. À exécuter par vous après déploiement : `SUPABASE_SERVICE_ROLE_KEY=... node test_send_push_regression.mjs` (depuis `athleteos/`).
- [x] Relecture du diff comme reviewer hostile — a trouvé et corrigé une régression réelle avant de conclure (blocage total d'`athleteIds` pour le rôle athlète, qui aurait cassé 3 fonctionnalités en prod). Voir "Décisions prises".
- [ ] Vérification manuelle de la syntaxe TypeScript par le compilateur Deno — **Deno CLI non installé dans cet environnement**, je n'ai pas pu faire tourner `deno check`. Le fichier suit exactement les mêmes imports/patterns que `admin-actions/index.ts` (déjà en prod), mais je ne peux pas affirmer qu'il compile sans l'avoir exécuté.
- [x] `node --check` sur `test_send_push_regression.mjs` — syntaxe JS valide.

## Résultats et limites
- **Rien n'a été commité, poussé, ni déployé.** Tout est en working tree, prêt à être relu.
- Domaine de prod (`https://athleteos-by-samuelmuhadri.vercel.app`) confirmé par vous et intégré en dur dans le code — plus d'action de configuration Supabase requise pour que le CORS fonctionne après déploiement. Reste à faire (vous, pas moi — je n'ai ni CLI Supabase installé ni vos identifiants) :
  1. Relire le diff.
  2. Commit + push (si vous validez).
  3. Déployer la fonction : `supabase functions deploy send-push` (depuis `athleteos/`, avec le CLI Supabase authentifié sur votre compte).
- **Aucun test réellement exécuté sur `send-push`** — le script existe et couvre tous les cas obligatoires de la tâche (401/403/200/400-413/CORS/cron) mais requiert un déploiement + des secrets live. Je n'affirme pas qu'il passe.
- Diagnostics d'éditeur ("Cannot find module 'https://deno.land/...'", "Cannot find name 'Deno'") sur `send-push/index.ts` : pré-existants, identiques sur les 3 autres Edge Functions du repo (pas de `deno.json`/`tsconfig.json` dédié) — pas une régression, hors périmètre de cette tâche.
- Risque résiduel identifié mais **hors périmètre** (à traiter séparément si besoin) : un utilisateur authentifié peut toujours insérer directement une ligne `push_subscriptions` avec un `athlete_id` d'un coéquipier de son propre club (RLS club-scoped mais pas propriétaire-scoped), ce qui permettrait en théorie d'intercepter les push adressées à ce coéquipier. La tâche 2 porte sur "un autre club ou des IDs arbitraires" — ce cas est intra-club, distinct, et non testé/couvert ici.

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 2 comme demandé. Ne pas démarrer la tâche suivante automatiquement.
