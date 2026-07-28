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

## Tâche active
- Numéro : 6
- Branche : main (travail effectué directement, non commité)
- Objectif : Auditer RLS, grants, vues et fonctions par rôle (head coach / coach / athlète propriétaire / athlète même club / autre club / anon), et corriger les accès trop larges à l'intérieur d'un club, pas seulement entre clubs.
- Risques : Migration SQL pas encore appliquée (voir "Résultats et limites") — jusque-là, la faille critique décrite ci-dessous reste active en production.

## Décisions prises
- **Audit fait sur l'état RÉEL de la base**, pas seulement sur les fichiers de migration locaux : `supabase/migrations/` ne contient que les correctifs à partir du 25/07 (RLS de base, fonctions, tables comme `users`/`athletes` existaient déjà avant, créées hors migration versionnée). Utilisé `supabase db advisors --linked` et `supabase db query --linked` (lecture seule, aucune écriture) pour inspecter policies/grants/fonctions tels qu'ils existent vraiment côté Supabase — sans ça, la faille ci-dessous (invisible dans les fichiers locaux) serait passée inaperçue.
- **Faille critique trouvée : une policy héritée et jamais nettoyée permettait une prise de contrôle inter-club.** La table `users` porte une colonne `auth_id` (uuid) totalement morte (aucun code applicatif ne l'écrit — vérifié par recherche complète dans `src/` et `supabase/functions/`), reliquat d'avant le passage au système actuel basé sur `auth_uid` (text). Une policy `"club members only"` (FOR ALL, jamais supprimée) autorisait encore tout compte connecté à s'insérer une ligne `users` avec `auth_id = auth.uid()` (sa propre valeur), sans AUCUNE vérification de club ou de rôle — les policies RLS permissives s'additionnent (OR), donc cette vieille policy contournait entièrement `users_insert_by_coach`. Une fois cette ligne insérée avec un `club_id`/`role` arbitraires, elle réactivait aussi 12 policies identiques mais jusque-là mortes sur `alerts`, `athletes`, `clubs`, `competition_athletes`, `competition_results`, `competitions`, `injuries`, `messages`, `performance_history`, `records`, `session_athletes`, `sessions` — donnant accès en lecture/écriture à n'importe quel club. Plus simple encore : `users_update_self` ne protégeait aucune colonne, donc un athlète pouvait directement se passer `role: "head_coach"` sur sa propre ligne.
- **Anon sur-privilégié au niveau des GRANTs Postgres** (indépendant des policies RLS) : le rôle `anon` avait DELETE/INSERT/SELECT/UPDATE sur quasiment toutes les tables métier. En pratique RLS bloquait déjà l'accès réel (toutes les policies club-scoped dépendent de `get_my_club_id()`, qui renvoie NULL pour anon — `club_id = NULL` n'est jamais vrai en SQL), mais ce n'est qu'un heureux hasard, pas une protection voulue. Vérifié qu'aucune page pré-connexion (Login/Signup/ResetPassword) ne fait le moindre `supabase.from(...)` — signup passe entièrement par l'Edge Function `signup` (service_role), login par `supabase.auth` — donc anon n'a besoin d'aucun droit table. Révoqué entièrement.
- **Portée resserrée sur ce que la tâche demande explicitement** ("le wellness, les blessures, les abonnements push et les données de compte nécessitent aussi des règles de propriété... à l'intérieur du club") : lu les fichiers qui écrivent/lisent réellement `athlete_wellness`, `injuries`, `push_subscriptions` avant de choisir les nouvelles règles, pour ne rien casser :
  - `athlete_wellness` : seul `WellnessModal.jsx` (auto-évaluation) y écrit ; `Rapports.jsx` (coach) le lit pour tout le club. Nouvelle règle : coach = lecture club entière, athlète = tout sur SES propres entrées, plus aucun accès entre coéquipiers.
  - `injuries` (donnée médicale) : `AthleteList.jsx` (coach) fait le CRUD complet sur tous les athlètes du club ; `InjuryReportModal.jsx` (athlète) ne fait qu'un auto-signalement. Nouvelle règle : coach = CRUD club entier, athlète = lecture + création sur ses propres blessures uniquement.
  - `push_subscriptions` : chaque ligne appartient à un `athlete_id` OU un `user_id` (coach) précis (`usePushNotifications.jsx`). Nouvelle règle : chacun ne gère que sa propre subscription. L'envoi réel (`send-push`, `weekly-cron`) passe par `service_role`, non affecté.
  - **Non touché volontairement** : `athlete_goals`, `athlete_performances`, `records`, `competition_results`, `session_athletes`, `social_*`, `messages`, `alerts` restent club-larges — la tâche ne les cite pas, et Performances.jsx/AthleteList.jsx s'appuient sur une visibilité club-large intentionnelle (classements, fil du club). Les toucher aurait dépassé le périmètre et risqué de casser des écrans qui n'ont pas été audités pour ça.
- **`users_insert_by_coach` resserrée** : un coach (pas head_coach) pouvait jusqu'ici créer une ligne `users` avec n'importe quel rôle, y compris `head_coach`, dans son propre club. Vérifié que le seul point d'insertion coach→users existant (`AthleteList.jsx`) pose toujours `role: "athlete"` — resserrer ("un coach ne peut créer que des athlètes, seul un head_coach peut créer un coach/head_coach") ne casse donc rien de réel.
- **Nouveaux helpers `get_my_role()` / `get_my_user_id()` / `get_my_athlete_id()`**, même convention que `get_my_club_id()` (SQL, STABLE, SECURITY DEFINER, `search_path` fixé, EXECUTE réservé à `authenticated`) — nécessaires pour écrire les nouvelles policies par propriétaire sans dupliquer de sous-requêtes.
- **Verrou anti-auto-promotion** : un trigger (pas une policy — RLS ne peut pas comparer colonne par colonne OLD vs NEW) bloque tout changement de `role`/`club_id` sur `users` par une requête REST d'un utilisateur connecté (`auth.role() = 'authenticated'`). Laisse passer `service_role` et le contexte migration/SQL editor (`auth.role()` y est NULL) pour ne pas se piéger soi-même en dashboard.
- **Corrections mineures issues de `supabase db advisors`** : `search_path` fixé sur les 3 fonctions triggers des tâches 16/18 (WARN "function_search_path_mutable") ; `get_my_club_id()` retiré des droits d'exécution d'`anon` (WARN "anon_security_definer_function_executable" — cette fonction renvoie toujours NULL pour anon, aucun usage légitime).
- **Non corrigé, documenté comme limite assumée** :
  - `pg_net` dans le schéma `public` (WARN "extension_in_public") : le déplacer risquerait de casser le cron `weekly-cron` déjà en prod (migration 20260727020000) sans pouvoir le retester sans docker local — jugé plus risqué que la remédiation ne vaut pour l'instant.
  - `auth_leaked_password_protection` désactivé (WARN) : réglage du service Auth (dashboard), pas du schéma SQL — hors périmètre d'une migration. Activable en 10 secondes : Dashboard → Authentication → Providers → Email → "Leaked password protection".
  - `signup_attempts` : RLS activée sans policy (INFO "rls_enabled_no_policy") — voulu et déjà documenté dans la migration d'origine (20260727030000) : seule `service_role` doit jamais y toucher.
  - Colonne `users.auth_id` (orpheline) : la policy dangereuse qui s'appuyait dessus est supprimée, mais la colonne elle-même n'est pas droppée dans cette migration (changement de schéma plus invasif, hors nécessité pour fermer la faille — peut être fait dans un futur nettoyage si vous le souhaitez).

## Fichiers modifiés
- `supabase/migrations/20260728130618_rls_ownership_and_grants_hardening.sql` (créé) : toutes les corrections ci-dessus.
- `test_rls_regression.mjs` (étendu, pas réécrit) : ajoute la couverture intra-club (athlète X vs athlète Y, même club) sur wellness/injuries/push, le test anti-auto-promotion, la reproduction exacte de la faille critique (insertion forgée dans un autre club), un test anon, et 3 appels RPC directs (`get_my_club_id`, `get_my_role`, `get_my_athlete_id`) — la structure existante (2 clubs, coach A vs club B) est conservée telle quelle.
- `status.md` : mis à jour.

## Vérifications exécutées
- [x] `npm run build` — succès (aucun fichier frontend touché par cette tâche, vérifié quand même).
- [x] `node --check test_rls_regression.mjs` — syntaxe valide.
- [x] **`supabase db advisors --linked --type security`** — exécuté réellement contre le projet lié, résultats lus et traités un par un (voir décisions ci-dessus).
- [x] **Dry-run réel de la migration contre la base de production**, dans une transaction `ROLLBACK` (donc **aucun changement persisté**) : `supabase db query --linked --file <migration avec COMMIT remplacé par ROLLBACK>` — exécuté sans aucune erreur SQL, puis revérifié que les 13 policies `"club members only"` étaient toujours présentes après coup (le rollback a bien annulé les changements). Ça confirme que la migration s'exécute correctement contre le schéma réel (bons noms de tables/colonnes/policies), mais ce n'est **pas** un test fonctionnel RLS complet.
- [x] **`supabase db push` exécuté par l'utilisateur — migration appliquée en production.**
- [x] **`node test_rls_regression.mjs` exécuté en conditions réelles par l'utilisateur (avec `SUPABASE_SERVICE_ROLE_KEY`) — 30/30 vérifications OK** (après une première passe à 27/30 : 3 "échecs" étaient en fait le test lui-même trop strict — il ne connaissait qu'un seul type de refus RLS silencieux, alors que la révocation des GRANTs d'`anon` produit un refus plus strict, au niveau permissions Postgres, avant même l'évaluation de RLS ; `checkNoReadAs` accepte désormais aussi ce cas pour les vérifications anon spécifiquement — voir `test_rls_regression.mjs`).
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo.

## Résultats et limites
- **Migration appliquée en production et vérifiée par les tests automatisés (30/30).** La faille critique (auto-promotion de rôle, prise de contrôle inter-club via `users`) est corrigée en conditions réelles.
- Rien n'a encore été commité ni poussé sur `origin/main` à ce stade — en attente de confirmation.
- **Limite assumée** : je n'ai pas pu lancer Postgres/Docker en local (non installés sur cette machine) — ma propre validation s'est donc faite en lecture seule + dry-run transactionnel contre la vraie base ; la validation fonctionnelle réelle (30/30) a été faite par l'utilisateur après application.

## Tests manuels recommandés (à faire par vous, après avoir appliqué la migration)
- [ ] Se connecter en tant qu'athlète, ouvrir "Mon bien-être" (wellness) et confirmer que ça fonctionne toujours normalement pour soi-même.
- [ ] Se connecter en tant que coach, confirmer que le tableau de bord blessures/wellness de tout le club s'affiche toujours normalement (`AthleteList.jsx`, `Rapports.jsx`).
- [ ] Confirmer que l'activation des notifications push fonctionne toujours (bouton "Activer les notifs").
- [ ] Confirmer qu'un coach peut toujours ajouter un nouvel athlète (`AthleteList.jsx`).

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 6 comme demandé. Ne pas démarrer la tâche 7 (qui en dépend) automatiquement.
