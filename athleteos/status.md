# AthleteOS - état du chantier

## Tâches précédentes
- **Tâche 1** (nettoyage dépôt/secrets/CI) : terminée, commitée (`88b27d4`) et poussée sur `origin/main`.
- **Tâche 2** (sécurisation `send-push`) : terminée, commitée (`2980909`), poussée, **déployée** et vérifiée en conditions réelles (10/11 tests automatisés OK).
- **Tâche 3** (durcissement `signup`) : terminée, **déployée** (migration + fonction), **9/9 tests automatisés OK en conditions réelles**.
- **Tâche 15** (langage scientifique prudent) : terminée, commitée (`fee2254`) et poussée. Texte uniquement.

## Tâche active
- Numéro : 16
- Branche : main (aucune branche dédiée créée — travail effectué directement, non commité)
- Objectif : Éliminer la divergence entre calculs JS et SQL pour la charge d'entraînement, et rendre les scores historiques reproductibles avec la version du modèle qui les a produits.
- Risques : Migration touchant `session_athletes` (ALTER TABLE + trigger) et remplaçant la vue `weekly_charge` en production — c'est la migration la plus structurante depuis le début du chantier.

## Décisions prises
- **Constat de départ** : le problème était déjà documenté en commentaire dans les migrations 20260726120000/123000 ("les coefficients ci-dessous DOIVENT rester synchronisés avec LOAD_COEFFICIENTS... faute de mécanisme partagé JS<->Postgres"). Confirmé en lisant `weekly_charge` : c'était une VUE recalculée à chaque lecture avec des coefficients codés en dur dans le SQL — donc un changement de coefficient aurait **immédiatement et silencieusement modifié l'historique de toutes les semaines passées**, exactement le risque que la tâche demande d'éliminer.
- **Source canonique choisie : une table Postgres versionnée** (`charge_model_versions`), pas un module généré. Une seule version peut être active à la fois (index unique partiel sur `is_active`).
- **Reproductibilité historique : chaque ligne `session_athletes` connaît sa propre version**, pas "la version actuelle". Un trigger (`stamp_session_athlete_model_version`) timbre automatiquement `session_athletes.model_version` avec la version active **au moment où le RPE est saisi ou modifié** — jamais recalculé rétroactivement. Choix du trigger plutôt que du code applicatif : il n'y a que 2 endroits qui écrivent un RPE (`AthleteApp.jsx`, `Planning.jsx`), mais un trigger ne peut pas être oublié dans un 3ᵉ écran futur, contrairement à un appel JS à dupliquer.
- **La vue `weekly_charge` fait maintenant une jointure sur la version de chaque ligne** (`LEFT JOIN charge_model_versions ON cmv.version = sa.model_version`) au lieu d'un `CASE` figé — c'est le changement central : activer une nouvelle version à l'avenir ne change plus les charges déjà calculées, seulement les nouvelles saisies.
- **Bornes + audit** : un trigger de validation (`validate_charge_model_version`) rejette toute valeur de coefficient hors de [0.1, 3.0] ou de récupération hors de [1h, 168h], à l'insertion ou la modification d'une version — donc pour n'importe quel chemin d'écriture, présent ou futur. Colonnes `created_at`/`created_by`/`notes` pour l'audit.
- **Version initiale ('v1') = valeurs EXACTEMENT identiques** à celles déjà en dur dans `trainingLoad.js` et l'ancienne vue — aucun score existant ne change de valeur avec cette migration, c'est un renommage/une mise sous contrôle, pas un recalcul.
- **Ce que je n'ai PAS fait, volontairement** :
  - **Pas d'écran coach pour créer une nouvelle version.** La tâche demande "permettre configuration coach uniquement dans des bornes et avec audit" — j'ai construit la couche données qui REND ÇA POSSIBLE (bornes appliquées en base, table prête, audit trail) mais je n'ai pas conçu ni construit l'écran (quels champs, où dans la nav, avec quelle confirmation). C'est un vrai morceau d'UI/UX à part entière, pas une extension naturelle du "versionner les coefficients". Aujourd'hui, créer une nouvelle version nécessite un accès direct à la base (SQL Editor Supabase) — ce qui est déjà correctement audité par les logs Postgres/Supabase eux-mêmes, et passe quand même par les bornes du trigger.
  - **Pas de versionnement des scores dérivés** (readiness/forme/fatigue/récupération/signal de charge — tâche 15) — ils sont recalculés à la volée côté client à partir de `weekly_charge`, jamais stockés. Puisque `weekly_charge` est maintenant lui-même reproductible par version, les scores dérivés le sont transitivement sans changement nécessaire de leur côté.
  - **Pas touché `loadAxes.js`** (poids des 6 axes de charge) — volontairement 100% client, aucune vue SQL ne les duplique (vérifié), donc aucun risque de divergence JS/SQL à corriger pour ce fichier. Hors périmètre strict de cette tâche (qui parle de "coefficients de charge", pas des axes).
  - **Pas de vérification "semaines ISO"** au sens d'un algorithme à unifier : `sessions.week` est un entier déjà calculé et stocké une fois côté client (`getISOWeek`) à la création de la séance — la vue SQL ne recalcule aucune semaine, elle lit `s.week` tel quel. Il n'y a donc pas de second algorithme ISO en SQL à faire diverger — vérifié, rien à faire ici.

## Fichiers modifiés
- `supabase/migrations/20260727040000_charge_model_versioning.sql` (créé) : table `charge_model_versions` (bornée, auditée, RLS lecture seule pour `authenticated`), colonne `session_athletes.model_version` + backfill vers 'v1', trigger de timbrage automatique, trigger de validation des bornes, vue `weekly_charge` réécrite pour joindre par version de ligne.
- `src/utils/trainingLoad.js` : ajout de `CURRENT_MODEL_VERSION = "v1"`, commentaires mis à jour pour pointer vers la table comme source canonique (le fichier JS reste une copie nécessaire au calcul instantané côté client, sa parité avec la base est maintenant testée).
- `test_charge_model_parity.mjs` (créé) : script de non-régression qui importe **directement** `computeSessionLoad`/`LOAD_COEFFICIENTS`/`RECOVERY_HOURS` du vrai code de prod (pas une réimplémentation séparée), vérifie la parité constantes JS ↔ base, un golden dataset de 3 séances (JS vs `weekly_charge` SQL), le timbrage automatique par le trigger, l'immutabilité du `model_version` sur une mise à jour non-RPE, et le rejet/l'acceptation aux bornes.

## Vérifications exécutées
- [x] `npm run build` — succès.
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo (cf. tâche 1).
- [x] `node --check` + exécution partielle de `test_charge_model_parity.mjs` (sans secrets) — confirme que l'import direct de `src/utils/trainingLoad.js` depuis un script Node fonctionne (pas d'erreur de résolution de module), et que le script s'arrête proprement sur le message attendu en l'absence de `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **`test_charge_model_parity.mjs` — écrit mais PAS exécuté contre la vraie base.** Nécessite que la migration soit appliquée (`supabase db push`, interdit dans cette tâche) et des secrets Supabase live que je n'ai pas. À exécuter par vous après migration (voir ci-dessous).
- [x] Relecture ligne par ligne de la migration SQL comme avant toute migration production (verrouillage, durée, backfill, valeurs NULL, doublons, contraintes, index, dépendances, RLS, grants, comportement des fonctions trigger sur `OLD` en contexte INSERT, compatibilité avec le frontend actuel) — détails dans la conversation, rien de bloquant trouvé. Je ne peux pas faire tourner `psql`/`deno` ici pour une vérification syntaxique automatisée — relecture manuelle uniquement.

## Résultats et limites
- **Rien n'a été commité, poussé, migré ni déployé.**
- **Ordre obligatoire** (comme la tâche 3) :
  1. `supabase db push` (applique la migration — crée la table, le trigger, réécrit la vue).
  2. `node test_charge_model_parity.mjs` (avec `SUPABASE_SERVICE_ROLE_KEY` défini, comme d'habitude — ne me le collez pas).
- **Aucune fonction Edge Function n'est concernée** — pas de `supabase functions deploy` nécessaire pour cette tâche, uniquement la base de données.
- **Dette assumée** : pas d'écran coach pour créer une nouvelle version (voir "Décisions prises"). Si un jour vous voulez ajuster un coefficient, ça se fait aujourd'hui via une nouvelle ligne dans `charge_model_versions` en SQL direct (dashboard Supabase), pas depuis l'app.

## Tests manuels recommandés (à faire par vous, après migration)
- [ ] Exécuter `node test_charge_model_parity.mjs` et vérifier que tout est ✅.
- [ ] Ouvrir l'app, saisir un RPE sur une séance réelle, vérifier dans la table `session_athletes` (dashboard Supabase) que `model_version` vaut `v1`.
- [ ] Vérifier qu'un écran affichant la charge (Dashboard, ChargeView, Rapports) affiche toujours des valeurs cohérentes avec avant la migration (les nombres ne doivent pas avoir changé, seule la façon dont ils sont calculés en interne a changé).

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 16 comme demandé. Ne pas démarrer la tâche suivante automatiquement.
