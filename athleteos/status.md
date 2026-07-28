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
- **Tâche 7** (suite RLS automatisée en CI locale) : terminée, **CI GitHub Actions verte** (`6a33dcf`, run #43). A révélé que le schéma d'origine n'était pas entièrement versionné (voir tâche 5) — corrigé par une migration socle (`20260720000000_baseline_schema_pre_migration_tracking.sql`) après 6 itérations de debug guidées par les vrais logs CI.
- **Tâche 5** (Supabase reproductible depuis zéro) : terminée, commitée (`00f13e5`) et poussée. **CI GitHub Actions verte** confirmée. Complète le socle de la tâche 7, enrichit `supabase/seed.sql`, génère `src/types/database.types.ts`, remplit `GUIDE_IA.md` (était vide).
- **Tâche 4** (hiérarchie de rôles + audit pour `admin-actions`) : terminée, commitée (`4580c8c` puis fix `23ea838`), poussée, **déployée** et **vérifiée en conditions réelles — 20/20 tests OK**. `rename_club`/`regenerate_invite_code`/`remove_user` resserrés au head coach uniquement (avant : accessibles à tout coach) ; nouvelle action `change_role` ; protection du dernier head coach ; table `audit_logs` ; idempotence.
- **Tâche 14** (compétitions et résultats transactionnels) : terminée, commitée (`d356ebf` puis fix `9b1ecd2`), poussée, **déployée** et **vérifiée en conditions réelles — 21/21 tests OK**, y compris un vrai test de concurrence (deux résultats battant le même record simultanément). Créer une compétition ou ajouter un résultat se faisait en plusieurs écritures séquentielles non protégées (jusqu'à 5 pour l'auto-déclaration athlète) ; remplacé par 4 RPC SQL atomiques (`create_competition_with_athletes`, `add_competition_result`, `create_solo_competition_result`, `mark_notification_outbox_sent`), verrouillage anti-concurrence sur `records` (nouvelle contrainte UNIQUE + `INSERT ON CONFLICT`/`FOR UPDATE`), idempotence, outbox de notifications écrit dans la transaction. **Bug réel trouvé au 1er test en conditions réelles** (pas juste en relecture) : `SECURITY DEFINER` manquant sur les 5 nouvelles fonctions — corrigé par une migration séparée (`20260730020000`).

- **Tâche 8** (stockage privé pour les fichiers sensibles) : terminée, migration appliquée par l'utilisateur (`supabase db push`), **déployée** et **vérifiée en conditions réelles — 10/10 tests automatisés OK** (`test_private_storage.mjs`). Bucket `session-pdfs` passé en privé (`public=false`) + `file_size_limit` (30 Mo) / `allowed_mime_types` (`application/pdf`) imposés côté serveur ; nouvelles policies SELECT/DELETE scopées par club ; PDFs ouverts via `createSignedUrl()` (TTL 60s) au lieu d'une URL publique stockée en base ; `deleteSession` (Planning.jsx) purge maintenant aussi le fichier storage (bug d'orphelinage préexistant, corrigé au passage). `social-photos` hors périmètre (fil social intentionnellement partagé dans tout le club, pas nommé dans l'objectif de la tâche). Contrôle "MIME trompeur" limité au Content-Type déclaré à l'upload (ce que Supabase vérifie réellement côté serveur) — pas d'inspection du contenu réel du fichier, jugé disproportionné pour des uploads de comptes authentifiés du club.

## Tâche active
Aucune — arrêt après la tâche 8 comme demandé.

## État du socle Supabase (repères utiles pour les prochaines tâches)
- `supabase/config.toml`, `supabase/seed.sql`, `supabase/migrations/20260720000000_*` et `20260720000001_*` (socle + index/event trigger) : base entièrement reproductible depuis zéro via `supabase start`/`db reset`, prouvé par CI.
- `.github/workflows/rls-check.yml` : reconstruit et teste la base à chaque push/PR sur `main`, contre une instance locale, jamais la production.
- `GUIDE_IA.md` : mode d'emploi (démarrage local, connexion, compte de test, régénération des types, liaison au projet distant, distinction déploiement frontend/Supabase).
- **`supabase db push` et les 2 migrations socle** : `db push` refuse par défaut toute migration si des fichiers locaux datés avant la dernière migration distante existent (c'est le cas des 2 fichiers socle, datés exprès avant l'historique réel). Si ça se reproduit : `supabase migration repair --status applied 20260720000000 20260720000001 --linked` (une seule fois) puis `supabase db push` normalement — jamais `--include-all`.
- **Toujours créer les nouvelles fonctions SQL avec `SECURITY DEFINER` explicite** quand elles doivent lire/écrire des tables sans grant direct pour `authenticated` (ex: `rpc_idempotency`, `notification_outbox`, `audit_logs`) — un oubli a cassé la tâche 14 au premier test réel, corrigé mais évitable si vérifié en relecture la prochaine fois (comparer avec `get_my_club_id()`/`signup_create_account` comme référence).
- **Limite connue, jamais vérifiée faute de Docker sur cette machine** : `pg_cron`/`pg_net` (cron hebdomadaire) s'installent et s'enregistrent sans erreur en local, mais leur déclenchement réel n'a jamais pu être observé en local — seule la production l'a réellement exécuté.
- **Pas de compte de connexion réel dans le seed** (décision assumée, tâche 5) — procédure manuelle documentée dans `GUIDE_IA.md`.

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 14 comme demandé.
