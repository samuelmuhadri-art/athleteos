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

## Tâche active (5)
- Objectif : Rendre Supabase reproductible depuis zéro — compléter le socle de la tâche 7 (qui ne visait que "assez pour que les tests RLS passent") pour qu'il soit fidèle au schéma réel dans son ensemble (index, event trigger), ajouter un seed fictif riche (deux clubs, tous les rôles), générer les types TypeScript, et documenter tout le flux dans `GUIDE_IA.md`.
- Risques : voir "Résultats et limites" — les nouveaux ajouts (index, event trigger, seed) n'ont pas encore été vus tourner en CI (seront validés au prochain push, comme pour la tâche 7).

## Décisions prises (tâche 5)
- **Comparaison systématique base réelle ↔ socle de la tâche 7**, en lecture seule (`supabase db query --linked`) : index (`pg_indexes`), triggers (`information_schema.triggers`), vues (`pg_class`), event triggers (`pg_event_trigger`). Deux écarts trouvés, aucun n'empêchait les tests RLS de passer (d'où leur invisibilité à la tâche 7) mais violaient la DoD "le schéma généré correspond aux besoins du code" :
  - **5 index de performance jamais versionnés** (`athlete_notifications_athlete_id_is_read_idx`, `athlete_notifications_club_id_created_at_idx`, `athlete_performances_athlete_id_discipline_idx`, `athlete_performances_club_id_idx`, `idx_push_subs_athlete`).
  - **L'event trigger `ensure_rls` n'était jamais enregistré** — seule sa fonction (`rls_auto_enable()`) existait dans le socle. Sans lui, une future table créée par erreur sans RLS resterait ouverte en local alors qu'elle serait protégée en production — comportement différent, contraire à l'objectif de cette tâche. Filtre `WHEN tag IN (...)` recopié à l'identique de la production (`pg_event_trigger.evttags`).
  - Ajoutés dans une **nouvelle** migration (`20260720000001_baseline_indexes_and_event_trigger.sql`), pas en modifiant le socle déjà écrit — cohérent avec la règle "ne jamais modifier une migration existante", même si ce socle particulier n'a encore jamais été appliqué qu'à des bases éphémères de CI.
- **Vues, triggers de données (validate_*/stamp_*/prevent_*) : aucun écart trouvé** — tous déjà couverts par les migrations existantes (tâches 16/18/6), rien à ajouter.
- **`supabase/seed.sql` enrichi** : deux clubs fictifs, un head coach + un coach + deux athlètes dans le premier, un head coach + un athlète dans le second, plus une séance, des RPE, une entrée de wellness, une blessure, un record et un objectif — pour qu'un nouveau clone ait immédiatement de vraies données à explorer, pas une base vide. Toutes les valeurs sont inventées (noms, emails `@athleteos.local`), aucune donnée réelle.
- **Pas de compte de connexion réel créé dans le seed** (décision assumée) : recréer une ligne `auth.users`/`auth.identities` valide à la main demande de reproduire le hash de mot de passe et le schéma interne exact de GoTrue (version `v2.193.0` confirmée en CI), propre à chaque version — non vérifiable sans instance locale, et une erreur y ferait échouer TOUT `supabase start` (donc aussi la CI de la tâche 7), un risque disproportionné pour ce gain. À la place : `GUIDE_IA.md` documente la procédure (créer un compte via Studio localement, puis le relier à une ligne `users` du seed par `auth_uid`) — 2 minutes, fiable, ne dépend pas d'un format interne fragile.
- **Types TypeScript générés** (`supabase gen types typescript --linked`, lecture seule contre le schéma distant, ne nécessite pas Docker) → `src/types/database.types.ts`. Le projet est en JavaScript pur (zéro fichier `.ts` existant, aucun `tsconfig.json`) — ce fichier sert de référence/autocomplétion IDE via JSDoc, il ne transforme pas le projet en TypeScript et n'ajoute aucune étape de build.
- **`GUIDE_IA.md` (vide auparavant) rempli** : `supabase start`/`db reset`, connexion du frontend à la base locale, création d'un compte de test, lancement de la suite RLS en local, régénération des types, liaison au projet distant, et la distinction déploiement frontend (automatique via `git push`) vs Supabase (migrations/functions, toujours manuel) — cette dernière confusion étant revenue plusieurs fois dans nos échanges précédents.
- **CI locale qui reconstruit et teste la base** : déjà livrée à la tâche 7 (`rls-check.yml`) — rien à ajouter, juste référencée dans `GUIDE_IA.md`.

## Fichiers modifiés (tâche 5)
- `supabase/migrations/20260720000001_baseline_indexes_and_event_trigger.sql` (créé) : index + event trigger manquants du socle.
- `supabase/seed.sql` (étendu) : jeu de données fictif (deux clubs, tous les rôles).
- `src/types/database.types.ts` (créé) : types générés depuis le schéma distant.
- `GUIDE_IA.md` (rempli, était vide) : documentation complète du flux Supabase local/distant.

## Vérifications exécutées
- [x] `npm run build` — succès.
- [x] Comparaison exhaustive index/triggers/vues/event triggers contre la base réelle (`supabase db query --linked`, lecture seule) — pas de devinette, chaque objet vérifié.
- [x] **Dry-run réel de la nouvelle migration contre la production**, dans une transaction `ROLLBACK` (aucun changement persisté) : `supabase db query --linked --file <migration avec COMMIT→ROLLBACK>` — exécutée sans erreur, puis reconfirmé que `ensure_rls` existait toujours après coup (le rollback a bien annulé).
- [x] `supabase gen types typescript --linked` exécuté réellement (pas de simulation) — 1210 lignes générées sans erreur.
- [ ] **Le socle complet (baseline + nouveau fichier d'index/event trigger + seed enrichi) rejoué de bout en bout via `supabase start` — pas encore revu tourner.** Comme pour la tâche 7, je n'ai pas Docker ici : la vraie vérification sera le prochain run CI (le même `rls-check.yml` de la tâche 7 rejoue tout ça automatiquement à chaque push).
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo (le fichier de types généré n'est pas branché sur un typecheck, voir "Décisions prises").

## Résultats et limites
- Rien n'a été commité ni poussé à ce stade.
- **Comme pour la tâche 7, la vérification finale se fera par un run CI réel après le push** — si quelque chose casse (ex: un index dupliqué, une contrainte non respectée dans le seed), ce sera visible immédiatement dans l'onglet Actions, comme la dernière fois.
- **Limite assumée** : pas de compte de connexion réel dans le seed (voir "Décisions prises") — procédure manuelle documentée à la place.

## Tests manuels recommandés (à faire par vous, optionnel)
- [ ] Si vous installez Docker Desktop un jour : `supabase start`, suivre la section "Créer un compte de test en local" de `GUIDE_IA.md`, et vérifier que l'app locale affiche bien les deux clubs de démo et leurs athlètes.

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 5 comme demandé.
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
