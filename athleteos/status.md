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
- **Tâche 7** (suite RLS automatisée en CI locale) : terminée, **CI GitHub Actions verte** (`6a33dcf`, run #43). L'ancienne CI testait contre la production et échouait silencieusement depuis toujours (secrets GitHub jamais configurés) ; remplacée par une instance Supabase locale et jetable (Docker, runner GitHub) qui rejoue toutes les migrations + le seed à partir d'une base vide, puis lance la suite deux fois de suite. Au passage, a révélé que le schéma d'origine n'était pas entièrement versionné (voir tâche 5) — corrigé par une migration socle (`20260720000000_baseline_schema_pre_migration_tracking.sql`) après 6 itérations de debug guidées par les vrais logs CI (jamais de correction à l'aveugle) : ordre fonction/table, guillemets `supabase status -o env`, version de Node.
- **Tâche 5** (Supabase reproductible depuis zéro) : terminée, commitée (`00f13e5`) et poussée. **CI GitHub Actions verte** confirmée par l'utilisateur. Complète le socle de la tâche 7 (5 index de performance + l'event trigger `ensure_rls` manquants, trouvés par comparaison systématique avec la base réelle), enrichit `supabase/seed.sql` (deux clubs fictifs, tous les rôles, données de démo), génère `src/types/database.types.ts` (référence IDE, le projet reste en JS pur), et remplit `GUIDE_IA.md` (était vide) avec le flux complet local/distant.
- **Tâche 4** (hiérarchie de rôles + audit pour `admin-actions`) : terminée, commitée (`4580c8c` puis fix `23ea838`), poussée, **déployée** (migration `audit_logs` + Edge Function) et **vérifiée en conditions réelles — 20/20 tests OK** (`test_admin_actions.mjs`, cleanup y compris après correction d'un bug de nettoyage). Migration appliquée via `supabase migration repair --status applied` sur les 2 fichiers socle de la tâche 7/5 (datés avant l'historique réel, donc jamais rejoués sur la vraie base) puis `supabase db push` normal.

## Tâche active
- Numéro : 14
- Objectif : Rendre atomiques la création de compétitions et l'ajout de résultats (RPC SQL contrôlées par autorisation, verrouillage anti-concurrence sur les records, idempotence, outbox de notifications écrit dans la même transaction).
- Risques : voir "Résultats et limites" — rien n'est déployé (ni migration ni redéploiement frontend nécessaire côté Vercel), le comportement ACTUEL en production reste l'ancien (écritures séquentielles non atomiques) tant que vous n'avez pas appliqué la migration.

## Décisions prises (tâche 14)
- **Deux points d'entrée fragiles trouvés** : `Competitions.jsx` (créer une compétition = 2 inserts séparés ; ajouter un résultat = jusqu'à 4 écritures) et `AthletePerfs.jsx` (`handleAddComp`, un athlète déclarant seul une compétition = jusqu'à 5 écritures : compétition, lien, résultat, performance, record). Une panne entre deux étapes laissait un état incohérent (compétition sans participant, résultat sans record mis à jour). Pire, dans `addResult` : si la mise à jour du record échouait, l'erreur était juste loguée et les notifications partaient quand même — exactement le "notification envoyée alors que l'écriture a échoué" cité par la tâche.
- **Risque de concurrence trouvé en concevant la protection, pas juste supposé** : verrouiller une ligne `records` existante (`SELECT ... FOR UPDATE`) ne protège PAS le cas "deux résultats simultanés sont le tout premier résultat de cette discipline" (rien à verrouiller avant que la ligne existe). Corrigé avec un `INSERT ... ON CONFLICT (athlete_id, discipline) DO NOTHING RETURNING id` (nécessite une nouvelle contrainte UNIQUE — vérifié au préalable qu'aucun doublon n'existait déjà en base) : Postgres tranche lui-même laquelle des deux insertions concurrentes "gagne", sans fenêtre où les deux se croient les premières.
- **3 RPC SQL créées** (migration `20260730010000`), chacune = une transaction Postgres complète (tout réussit ou rien n'est appliqué) :
  - `create_competition_with_athletes` : coach (n'importe quel athlète de son club) ou athlète (lui-même uniquement, un seul participant) — `club_id` toujours résolu côté serveur, jamais envoyé par le client.
  - `add_competition_result` : coach uniquement, résultat + record (verrouillé) + outbox en une transaction.
  - `create_solo_competition_result` : athlète, combine création de compétition + résultat + record + journal de performance (pour l'onglet Évolution) + breakdown décathlon/heptathlon, en un seul appel — avant, c'était le flux le plus fragile (5 écritures séparées).
  - Une logique interne partagée (`_apply_competition_result`) évite de dupliquer la partie sensible (verrouillage + comparaison + outbox) entre les deux RPC qui enregistrent un résultat.
- **Idempotence** : `idempotencyKey` optionnel, table `rpc_idempotency` générique (réutilisée par les 3 RPC), un succès déjà enregistré pour la même clé+action est renvoyé tel quel sans rejouer l'effet. Le frontend envoie systématiquement une clé fraîche (`crypto.randomUUID()`) à chaque action utilisateur.
- **Outbox de notifications** (table `notification_outbox`) : écrite DANS la même transaction que le résultat/record — jamais après. Le RPC renvoie le payload complet de chaque événement (pas juste un ID) pour que le client n'ait pas besoin d'un aller-retour supplémentaire ; les vraies notifications ne sont dépêchées qu'après le retour en succès du RPC (= commit confirmé), puis marquées "sent" via une 4e RPC (`mark_notification_outbox_sent`, scoping club vérifié).
- **Incohérence adjacente trouvée et corrigée** : deux AUTRES endroits écrivaient dans `records` sans jamais toucher aux nouvelles colonnes numériques `pr_value`/`sb_value` (`maybeUpdateRecord` dans `AthletePerfs.jsx`, pour les performances saisies hors compétition ; `addRecord` dans `AthleteList.jsx`, saisie manuelle par un coach). Laissés tels quels, ils auraient rendu `pr_value`/`sb_value` obsolètes dès la prochaine saisie manuelle, faussant silencieusement la comparaison faite par les nouvelles RPC. Corrigés pour maintenir ces colonnes à jour. `addRecord` avait aussi un bug latent indépendant (insert direct sans vérifier l'existant, doublons silencieux possibles) — corrigé en bascule insert/update explicite au passage, nécessaire de toute façon puisque la nouvelle contrainte UNIQUE(athlete_id, discipline) aurait fait échouer l'ancien code au 2e enregistrement d'une même discipline.
- **`isNewRecord` (competitionsShared.js) supprimée** : sa seule utilisation (Competitions.jsx) est remplacée par la comparaison faite côté serveur — code mort, supprimé plutôt que laissé traîner.

## Fichiers modifiés
- `supabase/migrations/20260730010000_transactional_competition_results.sql` (créé) : colonnes `pr_value`/`sb_value` + contrainte UNIQUE sur `records` (avec backfill), tables `rpc_idempotency`/`notification_outbox`, 4 RPC.
- `src/modules/Competitions.jsx` : `createCompetition`/`addResult` remplacés par des appels RPC.
- `src/modules/competitionsShared.js` : `isNewRecord` (devenue morte) supprimée avec son import.
- `src/athlete/views/AthletePerfs.jsx` : `handleAddComp` remplacé par l'appel RPC solo ; `maybeUpdateRecord` maintient désormais `pr_value`/`sb_value`.
- `src/modules/AthleteList.jsx` : `addRecord` passe en upsert explicite (compatible avec la nouvelle contrainte UNIQUE) et maintient `pr_value`/`sb_value`.
- `src/utils/notifications.js` : `dispatchOutboxNotifications` ajoutée (dépêche les événements outbox après succès du RPC, puis les marque traités).
- `test_competition_transactions.mjs` (créé) : suite de non-régression DB-dépendante, y compris un vrai test de concurrence (`Promise.all` sur deux résultats battant le même record en même temps).

## Vérifications exécutées
- [x] `npm run build` — succès (exécuté 3 fois, à chaque étape significative des changements JS).
- [x] **Dry-run réel de la migration contre la production**, transaction `ROLLBACK` (aucun changement persisté) — exécutée plusieurs fois au fil des corrections (une vraie erreur de syntaxe trouvée et corrigée : `leading` est un mot réservé SQL, utilisé par erreur comme nom de variable).
- [x] `node --check` sur les 3 scripts de test du dépôt (`test_admin_actions.mjs`, `test_rls_regression.mjs`, `test_competition_transactions.mjs`) — syntaxe valide, rien d'autre cassé.
- [x] Vérifié en lecture seule qu'aucun doublon `(athlete_id, discipline)` n'existait déjà dans `records` avant d'ajouter la contrainte UNIQUE (`group by ... having count(*) > 1`, zéro résultat) — sans ça, la migration aurait échoué au déploiement.
- [x] Recherche exhaustive de tous les autres points d'écriture sur `competitions`/`competition_results`/`records` dans le code (`Performances.jsx`, `Dashboard.jsx`, `AthleteApp.jsx` : lecture seule, rien à faire ; `AthleteList.jsx` : écriture trouvée et corrigée, voir "Décisions prises").
- [ ] **`node test_competition_transactions.mjs` — PAS exécuté.** Nécessite `supabase db push` (nouvelle migration), pas fait — je ne déploie jamais sans que vous me le demandiez.
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo.

## Résultats et limites
- Rien n'a été commité, ni déployé. Le comportement en production reste l'ancien (écritures séquentielles) tant que vous n'avez pas appliqué la migration.
- **Pour activer vraiment cette tâche** : `supabase db push` (migration `20260730010000` — pas d'Edge Function à déployer cette fois, tout est en RPC SQL), puis `SUPABASE_SERVICE_ROLE_KEY=... node test_competition_transactions.mjs`, puis "commit et push" pour le frontend (Vercel redéploie automatiquement).
- **Limite assumée** : je n'ai pas touché à `Performances.jsx`/`Dashboard.jsx` (lecture seule sur ces tables, rien à rendre atomique) ni au calcul `pctOfReference`/classements qui LISENT `records` — seule l'écriture était concernée par cette tâche.
- **Limite assumée** : "échec simulé à chaque étape" (vérification obligatoire de la tâche) n'a pas pu être fait — simuler une panne mi-transaction nécessiterait soit une base locale (pas de Docker ici), soit d'interrompre volontairement une vraie requête contre la production (jugé trop risqué sans le demander). L'atomicité repose sur une garantie structurelle de Postgres (une fonction plpgsql = une transaction, tout ou rien) plutôt que sur un test d'injection de panne — solide en théorie, mais pas observé en pratique par moi.

## Tests manuels recommandés (à faire par vous, après déploiement)
- [ ] Créer une compétition avec plusieurs athlètes engagés, confirmer qu'ils apparaissent tous.
- [ ] Ajouter un résultat qui bat un record, confirmer la notification ET l'alerte "nouveau record" ET le post dans le fil du club.
- [ ] Depuis l'app athlète, déclarer soi-même une compétition + résultat (decathlon avec breakdown si possible), confirmer qu'elle apparaît côté coach ET dans l'onglet Évolution de l'athlète.
- [ ] Consulter `notification_outbox` (SQL Editor) après quelques actions, confirmer que le statut passe bien à `sent`.

## Décisions prises (tâche 4)
- **Faille trouvée** : `admin-actions/index.ts` traitait `head_coach` et `coach` de façon identique (`isCoach`) pour renommer le club, régénérer le code d'invitation et supprimer un membre — un simple coach avait donc les mêmes pouvoirs structurels qu'un head coach, contrairement à ce qu'attend une appli multi-club. Resserré à `role === "head_coach"` pour ces 3 actions (+ la nouvelle `change_role`).
- **Nouvelle action `change_role`** (head coach uniquement, même club, jamais sur soi-même) : n'existait pas du tout avant — aucune UI ni fonction ne permettait de changer le rôle d'un membre. Nécessaire pour "prévoir un transfert de propriété avant départ du dernier head coach" (promouvoir quelqu'un d'autre en head coach avant de partir).
- **Protection du dernier head coach** ajoutée sur `remove_user` (suppression) et `change_role` (rétrogradation) : compte les head coaches restants du club en excluant la cible, refuse si ça tomberait à zéro. **Limite honnête découverte en écrivant les tests** : avec l'auto-suppression et l'auto-changement de rôle déjà bloqués (règle préexistante, non touchée), ce garde-fou ne peut mathématiquement se déclencher QUE si l'appelant cible lui-même — un cas déjà intercepté avant lui. Gardé quand même en défense en profondeur (documenté dans le code), mais le vrai chemin testé et fonctionnel est : un head coach transfère la propriété à un second head coach, qui peut ensuite retirer le premier — testé de bout en bout dans `test_admin_actions.mjs`.
- **Table `audit_logs` créée** (nouvelle migration) : une ligne par tentative sur une action sensible (rename_club/regenerate_invite_code/remove_user/change_role), avec acteur, club, cible, payload, résultat (success/denied/error) et date. Lecture réservée au head coach de son propre club (RLS), écriture uniquement via service_role (cette fonction). `update_profile` n'est volontairement pas auditée (pas une action structurelle).
- **Idempotence** : un `idempotencyKey` optionnel dans le payload ; si fourni et qu'un succès a déjà été enregistré pour cette clé + cette action, l'action n'est pas rejouée (le résultat mis en cache est renvoyé tel quel). Un échec/refus précédent avec la même clé peut être retenté normalement. Garanti aussi au niveau base (index unique partiel sur `(idempotency_key, action)` où `result='success'`), pas seulement en mémoire. `AccountSettingsModal.jsx` envoie désormais une clé fraîche (`crypto.randomUUID()`) à chaque clic sur renommer/régénérer.
- **Validation de payload** ajoutée partout (nom/rôle non vides et de longueur raisonnable, identifiant utilisateur entier positif, rôle parmi les 3 valeurs valides) — avant, seul un `.trim()` existait par endroits.
- **UI alignée** : la section "Nom du club"/"Code d'invitation" de `AccountSettingsModal.jsx` n'est plus visible que pour un head coach (avant : visible pour tout coach). Reste néanmoins un simple masquage — la vraie protection est côté serveur (vérifiée par les tests d'appel direct à la fonction, pas seulement via l'UI).
- **Auto-review, bug trouvé et corrigé avant de considérer le travail fini** : ma première version auditait certaines erreurs DEUX FOIS (une fois inline dans chaque branche, une fois dans le bloc `catch` général) — corrigé en centralisant l'écriture d'audit sur un seul site (contexte mutable rempli au fil de l'exécution, un seul appel à `logAudit` par requête).

## Fichiers modifiés
- `supabase/migrations/20260729010000_admin_actions_audit_log.sql` (créé) : table `audit_logs` + RLS + index d'idempotence.
- `supabase/functions/admin-actions/index.ts` (réécrit) : matrice d'autorisation, `change_role`, protection dernier head coach, validation, idempotence, audit.
- `src/components/ui/AccountSettingsModal.jsx` : section club/code réservée au head coach, clé d'idempotence envoyée.
- `test_admin_actions.mjs` (créé) : suite de non-régression, DB-dépendante (comme `test_send_push_regression.mjs`/`test_signup_regression.mjs` aux tâches 2/3).

## Vérifications exécutées
- [x] `npm run build` — succès.
- [x] **Dry-run réel de la nouvelle migration contre la production**, transaction `ROLLBACK` (aucun changement persisté) — exécutée sans erreur, puis reconfirmé que `audit_logs` n'existe pas sur la vraie base (le rollback a bien annulé).
- [x] `node --check test_admin_actions.mjs` — syntaxe valide.
- [x] Relecture attentive de `admin-actions/index.ts` ligne par ligne, y compris auto-révision qui a trouvé le bug de double-audit (voir "Décisions prises") et la limite mathématique du garde-fou "dernier head coach" — corrigés/documentés avant de considérer la tâche terminée.
- [x] **`node test_admin_actions.mjs` exécuté en conditions réelles par l'utilisateur — 20/20 vérifications OK**, y compris le nettoyage (après correction d'un bug : `.catch()` appelé sur une requête postgrest-js, qui ne l'implémente pas — même classe de bug que la tâche 3). Fixtures laissées par le premier plantage (4 comptes, 2 clubs, 17 lignes d'audit, toutes en `@example.invalid`) identifiées puis nettoyées manuellement en base, confirmé à zéro partout.
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo.

## Résultats et limites
- **Déployé et vérifié en conditions réelles.** Migration appliquée, Edge Function déployée, matrice d'autorisation testée avec de vrais comptes contre la vraie fonction.
- **Découverte pratique au déploiement** : `supabase db push` refuse par défaut d'appliquer une migration si des fichiers locaux plus anciens que la dernière migration distante existent — ici, les 2 fichiers socle des tâches 5/7 (datés avant l'historique réel exprès, pour que la base locale/CI se reconstruise dans le bon ordre). Résolu proprement avec `supabase migration repair --status applied <version...> --linked`, qui marque ces versions comme déjà appliquées dans l'historique SANS exécuter leur SQL (elles recréeraient des tables qui existent déjà) — **jamais** avec `--include-all`, qui aurait tenté de les rejouer pour de vrai sur la prod et échoué. Noté dans "État du socle" ci-dessous pour la prochaine fois.
- **Limite assumée** : le garde-fou "dernier head coach" dans `remove_user`/`change_role` n'est pas indépendamment testable via l'API aujourd'hui (voir "Décisions prises") — documentée honnêtement plutôt que masquée par un faux test.
- **`test_admin_actions.mjs` n'est pas branché sur la CI** (`rls-check.yml` exclut `edge-runtime` pour aller plus vite — cette fonction ne peut donc pas y tourner) — reste un test manuel post-déploiement, comme pour send-push/signup aux tâches 2/3.

## Tests manuels recommandés (à faire par vous, optionnel)
- [ ] Se connecter en tant que simple coach et confirmer que la section "Nom du club"/"Code d'invitation" a disparu de l'écran de réglages.
- [ ] Consulter la table `audit_logs` (SQL Editor Supabase) pour voir les vraies entrées créées par l'usage normal de l'appli.

## État du socle Supabase (repères utiles pour les prochaines tâches)
- `supabase/config.toml`, `supabase/seed.sql`, `supabase/migrations/20260720000000_*` et `20260720000001_*` (socle + index/event trigger) : base entièrement reproductible depuis zéro via `supabase start`/`db reset`, prouvé par CI.
- `.github/workflows/rls-check.yml` : reconstruit et teste la base à chaque push/PR sur `main`, contre une instance locale, jamais la production.
- `GUIDE_IA.md` : mode d'emploi (démarrage local, connexion, compte de test, régénération des types, liaison au projet distant, distinction déploiement frontend/Supabase).
- **Limite connue, jamais vérifiée faute de Docker sur cette machine** : `pg_cron`/`pg_net` (cron hebdomadaire) s'installent et s'enregistrent sans erreur en local, mais leur déclenchement réel n'a jamais pu être observé (job hebdomadaire, CI trop courte) — seule la production l'a réellement exécuté.
- **Pas de compte de connexion réel dans le seed** (décision assumée, tâche 5) — recréer les tables internes de Supabase Auth à la main est fragile et non vérifiable ; procédure manuelle documentée dans `GUIDE_IA.md` à la place.
- **`supabase db push` et les 2 migrations socle (tâche 4)** : `db push` refuse par défaut toute migration si des fichiers locaux datés avant la dernière migration distante existent (c'est le cas des 2 fichiers socle, datés exprès avant l'historique réel). Si ça se reproduit sur une future tâche : `supabase migration repair --status applied 20260720000000 20260720000001 --linked` (une seule fois, marque juste l'historique) puis `supabase db push` normalement — jamais `--include-all`, qui tenterait de recréer sur la vraie base des tables qui y existent déjà.

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 4 comme demandé.
