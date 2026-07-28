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

## Tâche active
Aucune — arrêt après la tâche 5 comme demandé.

## État du socle Supabase (repères utiles pour les prochaines tâches)
- `supabase/config.toml`, `supabase/seed.sql`, `supabase/migrations/20260720000000_*` et `20260720000001_*` (socle + index/event trigger) : base entièrement reproductible depuis zéro via `supabase start`/`db reset`, prouvé par CI.
- `.github/workflows/rls-check.yml` : reconstruit et teste la base à chaque push/PR sur `main`, contre une instance locale, jamais la production.
- `GUIDE_IA.md` : mode d'emploi (démarrage local, connexion, compte de test, régénération des types, liaison au projet distant, distinction déploiement frontend/Supabase).
- **Limite connue, jamais vérifiée faute de Docker sur cette machine** : `pg_cron`/`pg_net` (cron hebdomadaire) s'installent et s'enregistrent sans erreur en local, mais leur déclenchement réel n'a jamais pu être observé (job hebdomadaire, CI trop courte) — seule la production l'a réellement exécuté.
- **Pas de compte de connexion réel dans le seed** (décision assumée, tâche 5) — recréer les tables internes de Supabase Auth à la main est fragile et non vérifiable ; procédure manuelle documentée dans `GUIDE_IA.md` à la place.

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 5 comme demandé.
