# AthleteOS - état du chantier

## Tâches précédentes
- **Tâche 1** (nettoyage dépôt/secrets/CI) : terminée, commitée (`88b27d4`) et poussée sur `origin/main`.
- **Tâche 2** (sécurisation `send-push`) : terminée, commitée (`2980909`), poussée, **déployée** et vérifiée en conditions réelles (10/11 tests automatisés OK).
- **Tâche 3** (durcissement `signup`) : terminée, **déployée** (migration + fonction), **9/9 tests automatisés OK en conditions réelles**.
- **Tâche 15** (langage scientifique prudent) : terminée, commitée (`fee2254`) et poussée.
- **Tâche 16** (versionnement JS/SQL des coefficients de charge) : terminée, commitée (`10e036c`) et poussée. Migration appliquée et testée avec succès par l'utilisateur.

## Tâche active
- Numéro : 17
- Branche : main (aucune branche dédiée créée — travail effectué directement, non commité)
- Objectif : Remplacer l'heure fixe de récupération et l'état binaire "totalement récupéré" par une estimation par plage, modulée par les données disponibles, avec un niveau de confiance et les facteurs contributifs affichés.
- Risques : Aucun — changement 100% JavaScript côté client, aucune base de données, aucune Edge Function concernée.

## Décisions prises
- **Pas de nouvelle migration.** La récupération est calculée à la volée côté client, jamais stockée ni dupliquée en SQL (contrairement à `weekly_charge`, tâche 16) — donc aucun risque de mutation silencieuse de l'historique à corriger en base. Les plages de base restent versionnées comme convention documentée dans le code (`RECOVERY_HOURS_RANGE`, liée à `CURRENT_MODEL_VERSION`), pas dans une table : il n'y a pas de parité JS/SQL à garantir puisqu'il n'existe aucun second calcul SQL de la récupération.
- **`RECOVERY_HOURS_RANGE`** remplace le point fixe `RECOVERY_HOURS` par catégorie (ex: sprint 72h → plage 48-96h, centrée sur l'ancienne valeur). `RECOVERY_HOURS` (l'ancien point) est conservé tel quel pour ne rien casser côté compatibilité, mais n'est plus utilisé par le nouveau calcul.
- **`estimateRecovery()`** (nouvelle fonction, remplace `computeRecoveryStatus`) module la position dans cette plage à partir de : la charge relative de la séance déclenchante vs la moyenne récente de l'athlète, le RPE de cette séance, le wellness le plus récent **si disponible ET récent** (≤36h, sinon ignoré plutôt qu'utilisé comme s'il reflétait l'état actuel), et l'accumulation de séances difficiles sur 7 jours.
- **Confiance** : score 0-100 construit uniquement à partir des signaux réellement disponibles (séance connue = base ; charge relative calculable ; wellness frais ; historique suffisant) — jamais un chiffre affiché sans lien avec ce qui a pu être évalué.
- **Correction du vrai problème identifié** : l'ancienne fonction renvoyait `fullyRecovered: true` quand il n'y avait **aucune** séance récente — une certitude fabriquée à partir de rien. `estimateRecovery` renvoie maintenant explicitement `status: "insufficient_data"` (plage `null`), conformément à "prévoir données insuffisantes plutôt qu'inventer".
- **Ne bloque jamais une séance** : vérifié qu'aucun code existant (`chargeCalculations.js`, seul consommateur) ne conditionne une action bloquante sur la récupération — seulement de l'affichage et un signal composite. Le nouveau format préserve cette propriété (testé explicitement, voir tests).
- **Affichage des facteurs** : ajouté côté athlète dans `FormeDetailPanel.jsx` (section "Estimation détaillée", visible uniquement pour la carte Récupération) — plage, confiance, et liste des facteurs avec ▲/▼. Côté coach (`AthleteProfileTabs.jsx`), le texte de `generateContextAnalysis` (déjà affiché dans l'onglet Charge) inclut maintenant la plage et la confiance en une phrase — **pas** la liste détaillée des facteurs individuels, pour rester dans un diff raisonnable ; un vrai panneau de détail coach équivalent à celui de l'athlète serait une extension UI à part.

## Fichiers modifiés
- `src/utils/trainingLoad.js` : nouvelle fonction `estimateRecovery()` (remplace `computeRecoveryStatus`), nouvelle constante `RECOVERY_HOURS_RANGE`.
- `src/utils/chargeCalculations.js` : `getAthleteMetricsForWeek` utilise `estimateRecovery` (avec le wellness déjà chargé) ; le score `recuperation` (0-100) dérive maintenant du milieu de la plage (neutre à 50 si données insuffisantes, jamais un extrême inventé) ; `generateContextAnalysis` affiche la plage + la confiance au lieu d'un chiffre unique et d'un "récupération complète" catégorique.
- `src/athlete/shared.js` : texte `METRIC_SCIENCE.recuperation` mis à jour (formule, explication, libellés des seuils) pour refléter l'incertitude — "Probablement suffisante" au lieu de "Complète", etc.
- `src/athlete/components/FormeDetailPanel.jsx` : nouvelle section "Estimation détaillée" (plage, confiance, facteurs) pour la carte Récupération.
- `test_recovery_estimate.mjs` (créé) : test pur JS, **exécuté avec succès**, aucune base de données requise.

## Vérifications exécutées
- [x] `npm run build` — succès.
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo (cf. tâche 1).
- [x] **`node test_recovery_estimate.mjs` — exécuté réellement, 16/16 OK.** Contrairement aux tâches précédentes, ce test ne nécessite ni migration ni secret Supabase (fonction pure) — j'ai donc pu le lancer moi-même et vérifier honnêtement le résultat. Couvre : aucune séance (données insuffisantes, pas de fausse certitude), séance seule sans wellness, même séance avec wellness bon vs mauvais (estimations différentes), wellness ancien (traité comme absent), aucune donnée subjective, valeurs extrêmes (plafonds respectés, confiance bornée [0,100], plage jamais inversée), absence de toute clé de blocage automatique dans le résultat.
- [x] Recherche de toute référence résiduelle à l'ancien nom `computeRecoveryStatus` dans tout le repo — aucune (hors un commentaire explicatif volontaire).

## Résultats et limites
- **Rien n'a été commité ni poussé.**
- **Aucune action de déploiement nécessaire après le commit/push** — ni `supabase db push`, ni `supabase functions deploy`. Un simple push suffira, Vercel redéploiera le frontend automatiquement.
- **Limite assumée** : pas de panneau de détail équivalent côté coach (facteurs individuels) — le coach voit la plage et la confiance via le texte d'analyse contextuelle existant, mais pas la liste à puces ▲/▼. Amélioration possible dans une tâche dédiée à l'UI coach si souhaité.
- **Bandes larges par construction** (`BAND_WIDTH = 0.4`, soit 40% de l'étendue de la catégorie) : c'est un choix délibéré pour éviter de donner une fausse précision, mais ça peut aussi paraître "flou" à l'usage réel — à ajuster après retour utilisateur si la plage semble trop large ou trop étroite en pratique.

## Tests manuels recommandés (à faire par vous)
- [ ] Sur l'appli, taper sur la carte "Récupération" (état de forme athlète) et vérifier que la plage + confiance + facteurs s'affichent correctement et lisiblement.
- [ ] Comparer l'affichage un jour avec wellness rempli vs un jour sans, pour confirmer visuellement que la confiance et la plage changent.
- [ ] Vérifier côté coach (profil athlète, onglet Charge) que la phrase d'analyse contextuelle mentionne bien une plage d'heures, pas un chiffre unique.

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 17 comme demandé. Ne pas démarrer la tâche suivante automatiquement.
