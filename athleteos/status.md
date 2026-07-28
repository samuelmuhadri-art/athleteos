# AthleteOS - état du chantier

## Tâches précédentes
- **Tâche 1** (nettoyage dépôt/secrets/CI) : terminée, commitée (`88b27d4`) et poussée sur `origin/main`.
- **Tâche 2** (sécurisation `send-push`) : terminée, commitée (`2980909`), poussée, **déployée** et vérifiée en conditions réelles (10/11 tests automatisés OK).
- **Tâche 3** (durcissement `signup`) : terminée, **déployée** (migration + fonction), **9/9 tests automatisés OK en conditions réelles**.
- **Tâche 15** (langage scientifique prudent) : terminée, commitée (`fee2254`) et poussée.
- **Tâche 16** (versionnement JS/SQL des coefficients de charge) : terminée, commitée (`10e036c`) et poussée. Migration appliquée et testée avec succès par l'utilisateur.
- **Tâche 17** (récupération en plage + confiance) : terminée, commitée (`dc9929f`) et poussée.
- **Tâche 18** (profil de charge à 6 axes gouverné) : terminée, commitée (`399cc1b`) et poussée.
- **Tâche 11** (comparaisons chronométrées unifiées) : terminée, commitée (`04fda38`) et poussée.
- **Tâche 9** (registre central des disciplines) : terminée, commitée (`82de1c5`) et poussée.
- **Tâche 6** (audit RLS/grants/vues/fonctions par rôle) : terminée, commitée (`0522868`) et poussée. Migration appliquée par l'utilisateur (`supabase db push`), **30/30 tests automatisés OK en conditions réelles**.

## Tâche active
- Numéro : 7
- Branche : main (travail effectué directement, non commité)
- Objectif : Transformer `test_rls_regression.mjs` en vraie suite de non-régression (CRUD + vues + RPC + storage, pour head coach/coach/athlète propriétaire/coéquipier/autre club) et la faire tourner en CI contre une instance Supabase **locale**, jamais contre la production.
- Risques : voir "Résultats et limites" — cette tâche n'a **pas pu être vérifiée en exécution réelle** faute de Docker sur cette machine (voir plus bas), contrairement à toutes les tâches précédentes.

## Décisions prises
- **Aucune migration SQL cette fois** — tâche 7 est uniquement infra de test/CI, aucun changement de schéma ni de policy.
- **`supabase/config.toml` créé (`supabase init`)** : il n'existait pas du tout avant (le projet n'avait jamais été initialisé en local, seulement lié au projet distant via `supabase link`). Ce fichier est indispensable pour que `supabase start` (base locale, utilisée en CI) sache comment démarrer — sans lui, la tâche est irréalisable. Config par défaut, `major_version = 17` (identique à la prod), rien de custom.
- **`supabase/seed.sql` créé** : en vérifiant ce que `supabase start` aurait réellement en local, j'ai découvert que les buckets de stockage (`session-pdfs`, `social-photos`) n'ont **jamais été créés par une migration** — quelqu'un les a créés à la main dans le dashboard Supabase, à un moment donné, hors historique versionné. Sans ce fichier, une base locale fraîche n'aurait aucun bucket, et les nouveaux tests storage échoueraient pour une raison n'ayant rien à voir avec une régression RLS. `seed.sql` (exécuté automatiquement par `supabase start`/`db reset`, jamais par `db push`, donc jamais appliqué à la prod) recrée juste ces deux buckets si absents (`ON CONFLICT DO NOTHING`, idempotent).
- **`.github/workflows/rls-check.yml` réécrit** : avant, la CI lançait la suite RLS directement contre le projet **de production** (secrets `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`) — exactement ce que la Definition of Done de la tâche 7 interdit ("les tests ne touchent pas la production"). Remplacé par : démarrage d'une instance Supabase locale et jetable (Docker, fourni par le runner GitHub) via `supabase start`, qui rejoue toutes les migrations + le nouveau `seed.sql` à partir d'une base vide à chaque run, puis lance la suite deux fois de suite (déterminisme, vérification obligatoire de la tâche) contre cette instance locale. Plus aucun secret de production nécessaire dans ce workflow.
- **Suite de tests étendue à 5 profils** (au lieu de 2) : ajout d'un compte **coach simple** (Z, ni head_coach ni athlète) dans le club A, avec sa propre matrice de droits : peut créer un athlète dans son club (positif), **ne peut pas** créer un autre coach/head_coach (vérifie le correctif de la tâche 6), **ne peut pas** changer le rôle d'un autre membre.
- **IDOR sur relations enfants** (demandé explicitement par la tâche, pas encore couvert) : au lieu de juste lire un ID connu d'un autre club, on essaie d'**insérer, dans son propre club, une ligne qui référence par clé étrangère un objet d'un AUTRE club** — une séance (`session_athletes.session_id`) ou une compétition (`competition_results.competition_id`) du club B. Type de faille différent d'une simple lecture bloquée, et non testé jusqu'ici.
- **Couverture storage.objects ajoutée** : tentative d'upload dans le dossier du club B (doit échouer) puis dans son propre dossier (doit réussir), sur le bucket `session-pdfs` — vérifie en conditions réelles la policy corrigée par la migration `20260727010000_scope_storage_policies_by_club.sql`, jamais testée automatiquement jusqu'ici.
- **`package.json`** : ajout du script `test:rls` (`node test_rls_regression.mjs`) — juste un raccourci, aucun changement de comportement.
- **Non fait, volontairement** : un environnement de test distant séparé ("éventuellement", donc optionnel dans la tâche) — provisionner un second projet Supabase dédié aux tests est une décision de coût/infra qui vous revient, pas quelque chose à créer sans vous le demander.

## Fichiers modifiés
- `supabase/config.toml` (créé, via `supabase init`).
- `supabase/seed.sql` (créé) : recrée les buckets storage en local.
- `.github/workflows/rls-check.yml` (réécrit) : Supabase local au lieu de la production, suite lancée deux fois.
- `test_rls_regression.mjs` (étendu) : profil coach Z, IDOR relations enfants (session_athletes/competition_results), storage.objects, et acceptation des noms de variables d'environnement par défaut du CLI Supabase (`API_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY`) en plus des noms `VITE_*` existants.
- `package.json` : script `test:rls` ajouté.
- `status.md` : mis à jour.

## Vérifications exécutées
- [x] `npm run build` — succès.
- [x] `node --check test_rls_regression.mjs` — syntaxe valide.
- [x] Vérification manuelle des noms de colonnes réels (`competition_results.event`, `session_athletes.session_id/athlete_id/rpe`, `push_subscriptions`) directement en base via `supabase db query --linked` (lecture seule), pour être sûr que les nouveaux tests IDOR échouent à cause de RLS et non d'une faute de frappe sur un nom de colonne.
- [x] Confirmation que les buckets storage n'étaient définis nulle part dans les migrations (recherche texte dans `supabase/migrations/`) — d'où `seed.sql`.
- [ ] **Aucune exécution réelle de `supabase start` / de la nouvelle CI locale — impossible sur cette machine : ni Docker ni Docker Desktop ne sont installés** (`docker --version` échoue, `supabase status`/`supabase db dump --linked` avaient déjà échoué pour la même raison lors de la tâche 6). Le workflow et les nouveaux tests sont donc du code écrit avec soin et relu plusieurs fois, mais **jamais exécuté**, ni par moi ni par vous, à ce stade.
- [ ] "Modifier temporairement une policy localement pour confirmer qu'un test échoue" (vérification obligatoire de la tâche) — **pas fait**, pour la même raison (pas de base locale disponible). Je n'ai pas non plus voulu le faire contre la production (affaiblir une vraie policy, même brièvement, sur la vraie base est le genre de risque que je ne prends pas sans vous le demander explicitement).
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo.

## Résultats et limites
- **C'est la première tâche de cette série que je ne peux pas vous garantir fonctionnelle avant que vous l'ayez vue tourner.** Tout le reste (SQL, JS pur) a été vérifié soit par exécution réelle, soit par lecture attentive + dry-run transactionnel contre la vraie base. Ici, la seule vérification possible sans Docker est la relecture manuelle du YAML et du script — ce que j'ai fait, avec soin, mais ce n'est pas la même chose qu'une exécution.
- **Ce qu'il faut pour valider vraiment** : soit (a) pousser sur `main` et regarder l'onglet "Actions" de GitHub tourner (l'environnement CI, lui, a bien Docker) — c'est la vraie première exécution, à surveiller ; soit (b) installer Docker Desktop sur cette machine si vous voulez pouvoir lancer `supabase start` vous-même en local avant de pousser.
- **Si la CI échoue au premier run**, ce sera probablement un détail d'infra (nom de variable d'environnement, service à exclure, permission Docker) plutôt qu'une vraie régression RLS — je resterai disponible pour corriger si vous me collez le log d'erreur.
- Rien n'a été commité ni poussé à ce stade — en attente de ta confirmation, et je recommande de **surveiller le premier run CI** avant de considérer cette tâche vraiment terminée.

## Tests manuels recommandés (à faire par vous)
- [ ] Après le push, ouvrir l'onglet "Actions" sur GitHub et vérifier que le job "RLS regression check" passe au vert (les deux exécutions de la suite).
- [ ] Si vous avez Docker Desktop : `cd athleteos && supabase start`, puis `supabase status -o env` pour récupérer les identifiants locaux, puis `node test_rls_regression.mjs` — pour rejouer la suite localement avant de faire confiance à la CI.

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 7 comme demandé.
