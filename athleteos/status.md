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
- **Tâche 7** (suite RLS automatisée en CI locale) : terminée. **CI GitHub Actions verte** (`6a33dcf`, run "RLS regression check" #43) — migrations + seed + suite complète exécutés deux fois de suite contre une instance Supabase locale et jetable, sans toucher la production. Détail dans "Tâches précédentes" ci-dessous a été laissé en place car l'historique de correction (6 itérations) est instructif pour la suite — voir git log entre `0522868` et `6a33dcf`.

## Tâche active
Aucune — arrêt après la tâche 7 comme demandé.

## Décisions prises (tâche 7)
- **`supabase/config.toml` créé (`supabase init`)** : le projet n'avait jamais été initialisé en local (seulement lié au projet distant). Indispensable pour que `supabase start` sache comment démarrer.
- **Trou majeur trouvé et corrigé : le schéma n'était pas entièrement versionné.** `users`, `clubs`, `athletes` et une quinzaine d'autres tables — plus leurs policies RLS d'origine et `get_my_club_id()` — avaient été créées à la main dans le dashboard Supabase avant le début du suivi des migrations. Invisible tant qu'on ne testait que contre la production (qui les a toujours eues). Corrigé par `supabase/migrations/20260720000000_baseline_schema_pre_migration_tracking.sql`, qui reconstruit fidèlement cet état (colonnes/contraintes/policies vérifiées une par une contre la vraie base en lecture seule, jamais devinées) et se place avant toutes les autres migrations.
- **`supabase/seed.sql` créé** : les buckets de stockage (`session-pdfs`, `social-photos`) n'ont eux non plus jamais été créés par une migration (créés à la main dans le dashboard). Sans ce fichier, une base locale fraîche n'a aucun bucket — recrée les deux, idempotent.
- **`.github/workflows/rls-check.yml` réécrit** : l'ancienne CI testait directement contre la **production** (secrets `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`) — en fait, en la regardant tourner, on a découvert que ces secrets n'avaient probablement jamais été configurés dans les réglages GitHub du dépôt : **la CI échouait silencieusement depuis sa création**, sans rapport avec ce travail. Remplacée par une instance Supabase locale et jetable (Docker, fournie par le runner GitHub), qui rejoue toutes les migrations + le seed à partir d'une base vide à chaque run, puis lance la suite deux fois de suite (déterminisme). Plus aucun secret de production nécessaire.
- **Suite de tests étendue à 5 profils** (au lieu de 2) : ajout d'un compte **coach simple** (Z, ni head_coach ni athlète), avec sa propre matrice de droits (peut créer un athlète, ne peut pas créer un autre coach/head_coach, ne peut pas changer le rôle d'un autre membre).
- **IDOR sur relations enfants** : insertion, dans son propre club, d'une ligne qui référence par clé étrangère un objet d'un AUTRE club (`session_athletes.session_id`, `competition_results.competition_id`) — type de faille différent d'une simple lecture bloquée, pas encore couvert avant.
- **Couverture storage.objects ajoutée** : upload forcé dans le dossier d'un autre club (doit échouer) puis dans son propre dossier (doit réussir).
- **`package.json`** : script `test:rls` ajouté (raccourci).
- **Non fait, volontairement** : un environnement de test distant séparé ("éventuellement", donc optionnel dans la tâche) — décision de coût/infra qui vous revient.

## Fichiers modifiés
- `supabase/migrations/20260720000000_baseline_schema_pre_migration_tracking.sql` (créé) : socle du schéma pré-migrations.
- `supabase/config.toml`, `supabase/seed.sql` (créés).
- `.github/workflows/rls-check.yml` (réécrit) : Supabase local, Node 22, suite lancée deux fois.
- `test_rls_regression.mjs` (étendu) : profil coach Z, IDOR relations enfants, storage.objects, noms de variables d'environnement du CLI local en plus des `VITE_*`.
- `package.json` : script `test:rls` ajouté.

## Vérifications exécutées
- [x] `npm run build` — succès.
- [x] **CI GitHub Actions réellement exécutée et VERTE** (commit `6a33dcf`, run #43) : les 17 migrations existantes + le socle + le seed s'appliquent proprement sur une base locale vide, et la suite complète (5 profils, isolation inter-club, isolation intra-club par propriétaire, anti-escalation de rôle, IDOR sur relations enfants, storage, RPC) passe **deux fois de suite** sans toucher la production.
- [x] Chemin de correction complet et documenté dans l'historique git (6 itérations, chacune avec un vrai message d'erreur diagnostiqué avant correction — jamais de correction "à l'aveugle") : schéma non versionné → ordre de création fonction/table → guillemets non retirés de `supabase status -o env` → version de Node trop ancienne pour `@supabase/supabase-js`.
- [ ] "Modifier temporairement une policy localement pour confirmer qu'un test échoue" (vérification obligatoire de la tâche) — pas fait : la CI est maintenant verte et fonctionnelle, mais je n'ai pas de moyen simple de déclencher un run CI supplémentaire rien que pour casser une policy exprès. Recommandé comme test manuel ci-dessous si vous voulez cette garantie précise.
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo.

## Résultats et limites
- **Tout est commité et poussé au fur et à mesure des corrections** (7 commits entre `a33cf90` et `6a33dcf`, tous sur `main`). Rien en attente.
- **Découverte notable, indépendante de cette tâche** : la CI ne fonctionnait probablement jamais avant aujourd'hui (secrets GitHub jamais configurés) — personne ne l'avait remarqué faute d'avoir regardé l'onglet Actions. C'est réglé de fait puisque la nouvelle CI n'a plus besoin de ces secrets.
- **Limite assumée** : `pg_cron`/`pg_net` (migration `weekly_cron_schedule`) se sont installées et le `cron.schedule(...)` s'est enregistré sans erreur en local — mais le job ne s'est jamais réellement déclenché pendant un run CI (trop court, tâche hebdomadaire), donc son exécution réelle reste vérifiée uniquement en production, pas en local.

## Tests manuels recommandés (à faire par vous, optionnel)
- [ ] Pour la garantie "la CI attrape vraiment une régression" : localement (si vous installez Docker Desktop un jour), affaiblissez temporairement une policy dans un fichier de migration, lancez `supabase start` + `node test_rls_regression.mjs`, confirmez que ça échoue, puis annulez le changement. Pas fait faute de Docker sur cette machine.

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 7 comme demandé.
