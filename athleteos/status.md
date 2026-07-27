# AthleteOS - état du chantier

## Tâches précédentes
- **Tâche 1** (nettoyage dépôt/secrets/CI) : terminée, commitée (`88b27d4`) et poussée sur `origin/main`.
- **Tâche 2** (sécurisation `send-push`) : terminée, commitée (`2980909`), poussée, **déployée** et vérifiée en conditions réelles (10/11 tests automatisés OK).
- **Tâche 3** (durcissement `signup`) : terminée, **déployée** (migration + fonction), **9/9 tests automatisés OK en conditions réelles**.
- **Tâche 15** (langage scientifique prudent) : terminée, commitée (`fee2254`) et poussée.
- **Tâche 16** (versionnement JS/SQL des coefficients de charge) : terminée, commitée (`10e036c`) et poussée. Migration appliquée et testée avec succès par l'utilisateur.
- **Tâche 17** (récupération en plage + confiance) : terminée, commitée (`dc9929f`) et poussée. Test pur JS exécuté avec succès (16/16), aucune migration nécessaire.

## Tâche active
- Numéro : 18
- Branche : main (aucune branche dédiée créée — travail effectué directement, non commité)
- Objectif : Gouverner le profil de charge à 6 axes — configuration versionnée, contributions par séance, baseline personnelle explicite, qualité de données, "convention AthleteOS" affichée.
- Risques : Faibles — nouvelle table Postgres additive (même pattern que la tâche 16, déjà éprouvé), aucune modification de données existantes, aucun calcul SQL touché (le profil à 6 axes reste 100% client).

## Décisions prises
- **Même architecture que la tâche 16, appliquée à `AXIS_WEIGHTS`** : nouvelle table `axis_model_versions` (version, poids jsonb imbriqué catégorie→axe, une seule version active, bornes [0,1] appliquées par trigger, colonnes d'audit). Portée volontairement identique à la tâche 16 : je construis la couche données gouvernée, pas d'écran coach pour créer une nouvelle version — ce qui satisfait de fait "mode par défaut verrouillé pour les pilotes" (aucun moyen de le déverrouiller sans accès direct à la base).
- **Pas de table `club_model_settings` séparée** pour une surcharge par club — la Definition of Done de cette tâche ne l'exige pas explicitement (contrairement à "Exécution détaillée" qui l'évoque comme piste), et l'ajouter aurait doublé la complexité de cette tâche pour une fonctionnalité qui a de toute façon besoin d'un écran d'édition inexistant pour être utile.
- **Baseline personnelle rendue explicite** : `getAthleteAxisProfile` expose maintenant `acute`/`chronic` bruts (pas seulement le ratio/score) — DoD "distinguer charge absolue, ratio à l'habitude". 
- **Qualité de données** : nouveau champ `dataQuality` (faible/modérée/élevée) basé sur le nombre de semaines d'historique disponibles, mêmes paliers que la confiance de `estimateRecovery` (tâche 17) pour rester cohérent dans toute l'app.
- **Contributions par séance** : nouvelle fonction `getAxisTopContributors()` — pour un axe donné, les séances des 2 dernières semaines qui y ont le plus contribué, triées. Répond concrètement au DoD "chaque axe explique ses principales contributions".
- **Affichage** : chaque ligne d'axe dans `AxisRadarCard.jsx` devient dépliable au clic (badge "Convention AthleteOS" + version, baseline, qualité de données, séances contributrices) — sans changer le radar ni la liste sobre par défaut, pour respecter le design existant. Ce composant est **partagé entre l'athlète et le coach** (déjà le cas avant cette tâche) : l'enrichissement profite donc aux deux automatiquement, sans duplication de code.
- **Export pour validation scientifique future** : satisfait par la table elle-même — n'importe qui avec un accès Supabase peut faire `SELECT * FROM axis_model_versions` et obtenir un JSON exportable avec version/poids/notes/date. Pas de bouton d'export dédié construit (aurait nécessité un écran, hors périmètre).
- **Bug préexistant corrigé en cours de route** : `loadAxes.js` importait `trainingLoad` sans extension `.js` — toléré par Vite mais pas par le résolveur ESM strict de Node, ce qui empêchait mon script de test de tourner. Corrigé (`./trainingLoad` → `./trainingLoad.js`), sans effet sur le comportement (Vite gère les deux formes identiquement) — vérifié par un rebuild complet après coup.

## Fichiers modifiés
- `supabase/migrations/20260728010000_axis_model_versioning.sql` (créé) : table `axis_model_versions` + trigger de validation des bornes + version `v1` = copie exacte d'`AXIS_WEIGHTS`.
- `src/utils/loadAxes.js` : `CURRENT_AXIS_MODEL_VERSION`, `getAthleteAxisProfile` enrichi (acute/chronic/dataQuality/weeksOfData), nouvelle fonction `getAxisTopContributors`, correction de l'import `trainingLoad.js`.
- `src/components/ui/AxisRadarCard.jsx` : lignes d'axe dépliables (provenance, baseline, qualité, contributions) ; nouvelles props optionnelles `sessions`/`athleteId`/`currentWeek`.
- `src/athlete/views/AthleteDashboard.jsx` et `src/modules/AthleteProfileTabs.jsx` : passent les nouvelles props à `AxisRadarCard`.
- `test_axis_profile.mjs` (créé) : test pur JS, **exécuté avec succès (11/11)**.
- `test_axis_model_parity.mjs` (créé) : test base de données (parité, bornes, version unique, non-mutation de 'v1') — écrit, pas exécuté (nécessite migration + secrets, comme tâche 16).

## Vérifications exécutées
- [x] `npm run build` — succès (3 fois : après le JS, après la correction d'import, vérification finale).
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo.
- [x] **`node test_axis_profile.mjs` — exécuté réellement, 11/11 OK.** Couvre : bornes et couverture complète des poids, golden dataset (charge par axe d'une séance connue, calculée à la main et vérifiée), baseline insuffisante (<2 semaines → null), reproductibilité (même entrée → même sortie), qualité de données croissante avec l'historique, exposition acute/chronic, tri des séances contributrices.
- [ ] **`test_axis_model_parity.mjs` — écrit mais PAS exécuté contre la vraie base.** Nécessite `supabase db push` (interdit dans cette tâche) et des secrets Supabase live. Vérifié manuellement par relecture croisée que les poids JS (`AXIS_WEIGHTS`) et le JSON seedé dans la migration sont identiques valeur par valeur.
- [x] Relecture de la migration SQL (verrouillage, bornes, RLS, grants, contrainte d'unicité partielle) — même schéma déjà validé et exécuté avec succès en tâche 16, donc risque résiduel faible.

## Résultats et limites
- **Rien n'a été commité, poussé, ni migré.**
- **Ordre de déploiement** (identique à la tâche 16) :
  1. `supabase db push` — crée `axis_model_versions`.
  2. `node test_axis_model_parity.mjs` (avec `SUPABASE_SERVICE_ROLE_KEY`, comme d'habitude).
- **Dette assumée** (même nature qu'en tâche 16) : pas d'écran coach pour créer une nouvelle version ou une surcharge par club — nécessite en base directement pour l'instant.
- **`getAxisTopContributors` suppose `sessions[].athleteIds`/`validations`** (format déjà utilisé partout ailleurs dans l'app) — pas de nouveau format introduit.

## Tests manuels recommandés (à faire par vous, après migration)
- [ ] Exécuter `node test_axis_model_parity.mjs` et vérifier que tout est ✅.
- [ ] Sur l'appli (athlète et coach), taper sur une ligne d'axe dans le "Profil de charge" et vérifier que le détail (convention, baseline, séances contributrices) s'affiche et reste lisible sur mobile.
- [ ] Vérifier qu'un axe sans assez d'historique (nouvel athlète) n'affiche toujours aucun radar plutôt qu'un score inventé (comportement inchangé, à reconfirmer visuellement).

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 18 comme demandé. Ne pas démarrer la tâche suivante automatiquement.
