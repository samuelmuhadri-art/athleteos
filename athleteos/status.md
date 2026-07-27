# AthleteOS - état du chantier

## Tâches précédentes
- **Tâche 1** (nettoyage dépôt/secrets/CI) : terminée, commitée (`88b27d4`) et poussée sur `origin/main`.
- **Tâche 2** (sécurisation `send-push`) : terminée, commitée (`2980909`), poussée, **déployée** et vérifiée en conditions réelles (10/11 tests automatisés OK — le seul échec était une clé mal collée localement lors du test manuel du chemin cron, pas un bug).
- **Tâche 3** (durcissement `signup`) : terminée, **déployée** (migration + fonction), **9/9 tests automatisés OK en conditions réelles**.

## Tâche active
- Numéro : 15 (traitée hors ordre — dépend nominalement des tâches 9-14, non faites — décision de l'utilisateur, pas la mienne)
- Branche : main (aucune branche dédiée créée — travail effectué directement, non commité)
- Objectif : Remplacer les formulations causales/prédictives/prescriptives autour d'ACWR, fatigue, readiness, récupération par un langage de signal contextualisé, sans changer les calculs sous-jacents ni le design.
- Risques : Aucun (changements textuels uniquement, aucune logique de calcul modifiée).

## Décisions prises
- **Inventaire fait par recherche textuelle systématique** dans `src/` (termes : risque, blessure, diagnostic, immédiatement, détecte, prédiction, danger, critique...), puis lecture complète des fichiers pertinents avant modification.
- **Constat de départ favorable** : `chargeCalculations.js`, `trainingLoad.js` et `loadAxes.js` avaient déjà des disclaimers "convention de coaching, pas une valeur publiée" en commentaire, et `athlete/shared.js` avait déjà un système `EVIDENCE_LEVELS` (validé / convention / calcul statistique) affiché dans `FormeDetailPanel.jsx` avec sources citées. Je me suis appuyé sur cette base existante plutôt que d'en recréer une parallèle.
- **Renommage du score composite `risque` → "Signal de charge"** (label affiché uniquement — la clé interne `risque`/`metrics.risque` n'a pas été touchée, pour limiter le risque de régression). C'était la formulation la plus problématique : libellé "Risque blessure", texte explicatif affirmant qu'elle "détecte les patterns dangereux", et une formule attribuée à tort à un "Modèle Gabbett" (Gabbett n'a jamais publié ces pondérations précises — ce sont des conventions AthleteOS inspirées de ses travaux). Le texte explicatif dit maintenant explicitement que ce n'est ni une prédiction individuelle ni un diagnostic, et cite les facteurs de risque connus qui n'y sont pas intégrés (sommeil, stress, antécédents, biomécanique).
- **Conseils de seuil reformulés** pour ne plus donner d'ordre médical ("Réduis immédiatement la charge. Consulte ton coach." → "Parles-en à ton coach pour décider ensemble... ce score n'est pas un ordre.") — conforme à la Definition of Done "le coach garde la décision finale".
- **Taxonomie ajoutée** (`METRIC_TAXONOMY` dans `athlete/shared.js`) : classe chaque métrique en measured / estimation / signal, avec une note explicite qu'aucune métrique de l'app n'est de catégorie "alerte médicale" (l'app ne diagnostique rien). C'est de la documentation/classification interne, pas un nouvel élément d'UI — je n'ai pas ajouté d'affichage visuel supplémentaire pour rester dans le périmètre "langage", pas "design".
- **Ce que je n'ai PAS fait, volontairement** :
  - Pas de nouvel indicateur numérique de "confiance"/fiabilité des scores (ex: signaler qu'un score basé sur 1 seule semaine de données est moins fiable qu'avec un historique long). C'est une vraie fonctionnalité (calcul + UI), pas une correction de langage — je l'ai plutôt traitée en ajoutant la limite en texte dans les explications ("what"). Voir "Limites" ci-dessous pour une vraie implémentation future.
  - Pas de renommage de la clé de données interne `risque` (`metrics.risque`, `dimColor("risque",...)`, etc.) — seuls les libellés affichés changent. Renommer la clé aurait touché beaucoup plus de fichiers pour un gain nul (personne ne voit les noms de clés JS).
  - Pas de relecture par un coach ou un professionnel scientifique — je ne peux pas le faire moi-même, voir "Vérifications obligatoires" ci-dessous.
  - Pas de vrai CAPTCHA/preuve scientifique publiée nouvelle — hors périmètre de cette tâche.

## Fichiers modifiés
- `src/athlete/shared.js` : renommage `risque` → "Signal de charge" (label + texte explicatif + formule + conseils de seuil), légère reformulation de `readiness.what`, ajout de `METRIC_TAXONOMY`.
- `src/utils/chargeCalculations.js` : reformulation de la ligne ACWR>1.5 dans `generateContextAnalysis()` (le pire cas trouvé : "risque de blessure accru. Réduire la charge immédiatement." → signal contextualisé + suggestion), commentaire mis à jour.
- `src/utils/coachFeed.js` : reformulation de la phrase "Fil du coach" pour ACWR critique.
- `src/utils/notifications.js` : reformulation de la description de l'alerte automatique de surcharge.
- `src/modules/ChargeView.jsx` : reformulation de l'alerte ACWR + légende du graphique ("Zone de danger" → "Zone à surveiller").
- `src/modules/AthleteProfileTabs.jsx` et `src/athlete/views/AthleteDashboard.jsx` : renommage des libellés courts "Risque"/"Risque blessure" → "Signal"/"Signal de charge".

Aucune formule de calcul, aucun seuil numérique, aucune migration, aucun schéma de données modifié — uniquement du texte.

## Vérifications exécutées
- [x] `npm run build` — succès.
- [ ] `npm run lint` / `npm run typecheck` — toujours aucun script dans le repo (cf. tâche 1).
- [ ] Tests automatisés — aucun test unitaire n'existe pour ces fonctions texte ; rien de pertinent à ajouter ici (ce sont des chaînes de caractères, pas de la logique testable au sens classique).
- [x] Recherche textuelle de tous les termes à risque cités dans la tâche (risque de blessure, réduire immédiatement, diagnostic, détecte, prédiction, certain...) — plus aucune occurrence problématique après correction (vérifié par re-recherche).
- [ ] **"Relecture UX par coach et professionnel scientifique" — PAS FAITE.** Je ne suis pas qualifié pour valider le fond scientifique, seulement la cohérence du langage avec les principes de prudence demandés. Recommandation forte : faire relire au minimum les nouveaux textes de `athlete/shared.js` (entrée `risque`) par quelqu'un du domaine avant une éventuelle commercialisation, comme le demande explicitement l'énoncé de la tâche.
- [ ] Test manuel dans le navigateur — **non fait**. Je n'ai pas de compte de test pour me connecter à l'appli déployée. Le build passe et j'ai relu chaque ligne modifiée, mais je n'ai pas visuellement confirmé le rendu (troncature de texte plus long dans les cartes compactes, notamment le nouveau texte "what" plus long pour `risque` dans `FormeDetailPanel.jsx`).

## Résultats et limites
- **Rien n'a été commité ni poussé.**
- **Limite technique assumée** : les scores restent calculés et affichés même avec très peu de données (ex: 1 seule semaine renseignée) sans indicateur de fiabilité réduite — seul le texte explicatif mentionne maintenant cette limite en toutes lettres, il n'y a pas de signal visuel distinct pour "peu de données". Implémenter un vrai indicateur de confiance (ex: griser ou annoter les scores basés sur moins de 3-4 semaines de charge) serait une tâche de suivi naturelle, distincte de celle-ci.
- **Textes plus longs** : plusieurs chaînes explicatives (`what` de `risque`, notamment) sont maintenant nettement plus longues pour être honnêtes sur les limites — à vérifier visuellement que ça ne casse pas la mise en page de `FormeDetailPanel.jsx` sur petit écran (test manuel recommandé ci-dessous).
- Le texte scientifique restant (README, GUIDE_IA.md) ne contient aucune formulation à risque — vérifié, rien à corriger là.

## Tests manuels recommandés (à faire par vous)
- [ ] Ouvrir `FormeDetailPanel.jsx` sur mobile pour l'athlète, taper sur "Signal de charge", vérifier que le texte plus long ne déborde pas.
- [ ] Vérifier le Fil du coach (Dashboard) avec un athlète en ACWR > 1.5 — la nouvelle phrase doit être lisible et ne pas paraître alarmiste au point de perdre l'info utile.
- [ ] Relecture par un coach/professionnel du sport, comme demandé par la Definition of Done de cette tâche.

## Prochaine tâche autorisée
Non déterminée ici — arrêt après la tâche 15 comme demandé. Ne pas démarrer la tâche suivante automatiquement.
