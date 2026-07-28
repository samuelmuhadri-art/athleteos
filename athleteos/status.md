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
Aucune — arrêt après la tâche 4 comme demandé.

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
