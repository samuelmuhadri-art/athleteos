# AthleteOS — dossier de revue post-refonte

Ce document accompagne `repomix-output.xml`. Il donne à un relecteur externe le contexte, les choix effectués, les preuves de validation et les points sur lesquels un avis critique est souhaité.

## Mise à jour — passe finale de qualité du 5 septembre 2026

Une nouvelle passe strictement corrective a été réalisée après la refonte. Aucun modèle scientifique, aucune donnée historique, aucune architecture club/athlète et aucune fonctionnalité produit n'ont été modifiés.

Bugs supplémentaires démontrés et corrigés :

- l'espace athlète utilisait `.single()` pour trouver le head coach alors que le produit autorise plusieurs head coaches ; la lecture sélectionne désormais le premier identifiant de manière déterministe sans échouer sur les clubs multi-head-coach ;
- les erreurs des lectures parallèles de l'espace athlète et des relations de la liste d'athlètes pouvaient être transformées silencieusement en listes vides ; elles alimentent désormais l'état d'erreur existant ;
- la messagerie coach contenait une seconde implémentation moins robuste du regroupement des conversations, en `O(messages × contacts)` ; elle partage maintenant l'indexation linéaire déjà utilisée côté athlète et ignore explicitement les messages qui ne concernent pas l'utilisateur connecté ;
- un échec d'envoi coach vidait le brouillon et n'était visible que dans la console ; le texte est maintenant conservé et une erreur accessible est affichée ;
- les deux listes de contacts indépendantes de la messagerie étaient chargées séquentiellement ; elles sont maintenant chargées en parallèle ;
- le planning reconstruisait les affectations, documents et destinataires par scans répétés pour chaque séance ; ces relations sont maintenant indexées une fois avant le mapping ;
- la comparaison de date de réponse à une séance et les fixtures E2E mélangeaient jour UTC et jour civil local autour de minuit ; elles utilisent maintenant la convention de date civile partagée.

Code supprimé ou mutualisé : trois helpers locaux dupliqués dans `Messaging.jsx` (formatage temporel et construction des conversations), remplacés par les helpers partagés de `athleteMessaging.js`. Aucun style ni composant n'a été supprimé sans preuve d'inutilité.

Cette passe est présente localement dans le Repomix mis à jour. Elle n'a pas été commitée ni poussée automatiquement.

## Demande au relecteur

Analyse le repository AthleteOS contenu dans `repomix-output.xml` et confronte le code réel au présent rapport.

Merci de donner un avis critique sur :

1. les risques de régression encore possibles ;
2. la qualité du responsive mobile/tablette/desktop ;
3. la cohérence des filtres du planning ;
4. la sécurité RLS et Storage des documents ;
5. les performances de distribution d'un document à de nombreux athlètes ;
6. la qualité et la pertinence des tests ;
7. les améliorations prioritaires avant une mise en production.

Ne te contente pas de ce résumé : cite les fichiers ou fonctions du Repomix qui confirment ou contredisent chaque conclusion. Distingue les bugs certains, les risques plausibles et les simples suggestions.

## État Git de référence

- Dépôt : `https://github.com/samuelmuhadri-art/athleteos.git`
- Branche : `main`
- Dernier commit applicatif audité : `5d8aded` (`fix: finaliser la passe UX post-refonte`)
- Commits structurants précédents :
  - `d38cf88` : planning scalable et documents ciblés ;
  - `500c3e9` : couverture des nouveaux parcours locaux ;
  - `5d8aded` : corrections UX, responsive, planning et overlays.

Le travail a été poussé sur `origin/main`. Aucun reset SMAC distant, `supabase db push` ou déploiement manuel de production n'a été exécuté pendant la passe.

## Objectif de la passe

La passe ne devait pas ajouter une nouvelle grande fonctionnalité. Elle devait terminer et fiabiliser l'existant après la refonte :

- messagerie coach sur mobile et tablette ;
- contenu caché par les navigations inférieures ;
- dashboard athlète et gamification ;
- lisibilité des plannings coach et athlète ;
- modales, drawers, petite hauteur et mode clair ;
- sémantique des groupes et disciplines ;
- pipeline documentaire, permissions et scalabilité ;
- tests de régression complets.

## Bugs reproduits et causes

### Messagerie coach

Sur mobile, la liste des conversations et la conversation restaient visibles simultanément. Les deux panneaux devenaient trop étroits et la zone de saisie était difficile à utiliser.

Cause : le composant `src/modules/Messaging.jsx` imposait une disposition en deux panneaux sans véritable état responsive single-pane.

### Objectifs de saison masqués

Le dernier contenu du dashboard coach pouvait rester sous le dock mobile.

Cause : les shells coach et athlète utilisaient un padding local et une chaîne flex/overflow incomplète. Les vues n'avaient pas toutes une réserve cohérente pour la navigation fixe et la safe-area.

### Modale de configuration en mode clair

La surface de certaines modales était transparente ou insuffisamment séparée du backdrop en mode clair.

Cause : `.modal-content` ne garantissait pas globalement un fond, une bordure, une ombre et un contraste thémés.

### Modale Compétition hors écran

À `320×568`, le haut de la modale de compétition dépassait le viewport, malgré une hauteur calculée correcte.

Cause : `.view-transition` conservait un `transform` après l'animation avec `animation-fill-mode: both`. Un descendant `position: fixed` se retrouvait alors positionné relativement au conteneur transformé et scrollé, et non au viewport.

### Filtres du planning

Le filtre discipline reposait surtout sur la discipline principale de l'athlète, au lieu de filtrer le contenu de la séance ou l'épreuve prévue. Groupe et athlète pouvaient aussi former une combinaison incohérente.

Cause : la logique de filtrage était directement mélangée au rendu de `Planning.jsx` et ne modélisait pas explicitement l'intersection de l'audience et de la discipline.

## Corrections livrées

### Messagerie

- Vue single-pane sous le breakpoint `lg`, y compris à `768×1024` en portrait.
- Liste seule au départ, puis conversation seule après sélection.
- Bouton accessible « Retour aux conversations ».
- Saisie et envoi maintenus au-dessus du dock mobile.
- Scroll de la conversation contenu dans la vue.
- Sur grand écran, liste limitée à environ 25–30 % et conversation dominante.

Fichier principal : `athleteos/src/modules/Messaging.jsx`.

### Shells et navigation mobile

- `min-h-0` ajouté aux maillons flex concernés.
- Scroll principal explicite selon le type de vue.
- Planning et messagerie gardent leur propre scroll interne.
- Classe partagée `.app-main-scroll` avec espace réservé pour le dock et la safe-area.
- Les racines utilisent déjà `100dvh` afin de mieux suivre le viewport mobile dynamique.

Fichiers : `athleteos/src/App.jsx`, `athleteos/src/AthleteApp.jsx`, `athleteos/src/index.css`.

### Dashboard athlète

- Bloc « Ma semaine » aligné avec le contenu principal, sans marge négative.
- Grille hebdomadaire adaptée aux petits écrans.
- Carte de prochaine compétition passée d'un rouge dominant à un dégradé bleu/violet.
- Gamification OFF : aucun rendu de badges.
- Gamification ON : un bouton compact `Progression · N badge(s)` renvoie vers Performances.
- Suppression de la grande collection de badges sur l'accueil.

Fichiers : `athleteos/src/athlete/views/AthleteDashboard.jsx`, `athleteos/src/index.css`.

### Planning athlète

- Ordre des vues : `Semaine | Mois | Liste | Archives`.
- Chaîne de hauteurs et de scroll corrigée.
- Jour sélectionné lisible en mode clair.
- Styles sobres distincts pour Stage, Test et Autre.

Fichier : `athleteos/src/athlete/views/AthletePlanning.jsx`.

### Planning coach et groupes

Le modèle réel trouvé est :

- `club_id` représente le tenant ;
- `athletes.group_name` représente l'équipe ou le groupe facultatif ;
- aucun nouveau système de sous-clubs n'a été créé.

Décision UX :

- aucun sélecteur « Tous les groupes » si une seule équipe existe ;
- affichage neutre `Équipe · Sprint` dans ce cas ;
- filtre de groupe uniquement si plusieurs valeurs réelles existent ;
- option globale renommée `Tous mes athlètes` ;
- options d'athlètes restreintes au groupe actif ;
- filtres groupe, athlète, discipline et période combinés par intersection ;
- discipline d'une séance déduite de sa catégorie/type ;
- discipline d'une compétition déduite des épreuves prévues.

Fichiers : `athleteos/src/modules/Planning.jsx`, `athleteos/src/modules/planningUtils.js`.

### Modales et overlays

- Surface partagée opaque, thémée et contrastée.
- Bordure et ombre partagées.
- Backdrop adapté au mode clair.
- Marges latérales et safe-areas.
- Hauteur maximale fondée sur `100dvh`.
- Contenu interne scrollable et footer accessible.
- Modale Compétition contrainte explicitement sur mobile, hauteur naturelle restaurée à partir de `640px`.
- Animation de changement de vue corrigée pour ne plus conserver de transform qui casse les descendants `fixed`.

Fichiers : `athleteos/src/index.css`, `athleteos/src/modules/CreateCompModal.jsx`, `athleteos/src/components/planning/PlanningEventModal.jsx`, `athleteos/src/components/modules/AthleteModulesManager.jsx`.

## Architecture documentaire vérifiée

Le code documentaire était déjà conforme au cahier des charges ; aucune réécriture supplémentaire n'a été nécessaire pendant la passe UX.

Pipeline réel :

1. validation locale du fichier ;
2. upload unique dans le bucket privé `session-pdfs` ;
3. enregistrement unique dans `documents` ;
4. distribution des associations par `publish_session_document_distribution` ;
5. création batchée des liens et notifications ;
6. lecture autorisée par RLS et policy Storage selon les associations.

Propriétés constatées :

- `runDocumentUploadQueue` utilise une concurrence par défaut de 4 ;
- chaque fichier est uploadé une seule fois ;
- la progression est suivie fichier par fichier ;
- un échec n'annule pas les fichiers réussis ;
- les fichiers en erreur peuvent être retentés individuellement ;
- la distribution d'un document à 30 athlètes utilise un seul objet Storage et un RPC batch ;
- un athlète non assigné et un membre d'un autre club ne peuvent pas ouvrir le document ;
- le destinataire voit le document immédiatement après publication dans le test d'intégration.

Fichiers principaux :

- `athleteos/src/services/documentLibrary.js` ;
- `athleteos/src/components/documents/DocumentLibraryField.jsx` ;
- `athleteos/src/utils/storage.js` ;
- `athleteos/supabase/migrations/20260903040000_document_library_batch_distribution.sql` ;
- `athleteos/test_document_distribution.mjs` ;
- `athleteos/test_scale_30_athletes.mjs` ;
- `athleteos/test_private_storage.mjs`.

Le transfert réseau du fichier reste naturellement le coût principal. Il est borné par la concurrence de 4 pour les multi-uploads. La distribution des destinataires n'ajoute ni 30 uploads ni 30 transferts du PDF.

## Tests ajoutés ou adaptés

### Tests unitaires

`athleteos/src/modules/planningUtils.test.js` couvre :

- l'intersection groupe + athlète ;
- la discipline basée sur la séance ;
- la famille de l'épreuve planifiée en compétition.

Les tests du dashboard athlète vérifient le résumé compact des badges et leur absence lorsque le module est coupé.

### Playwright

`athleteos/e2e/post-refonte.spec.js` ajoute des régressions pour :

- la messagerie single-pane à `375×812`, `390×844` et `768×1024` ;
- le retour conversation → liste ;
- la saisie et l'envoi réels d'un message ;
- la position de l'input par rapport au dock ;
- la proportion du split desktop ;
- le modal de configuration en mode clair ;
- le filtre discipline du planning ;
- la simplification d'une équipe unique ;
- les modales Compétition et Stage/Test à `320×568` ;
- le scroll jusqu'aux objectifs de saison à `375×812` et `390×844` ;
- l'alignement du planning athlète ;
- les badges compacts ;
- le traitement non rouge de la prochaine compétition ;
- l'absence de débordement horizontal sur toutes les largeurs cibles.

Les fixtures post-refonte utilisent un club local isolé pour éviter les courses avec les tests qui activent ou désactivent des modules en parallèle.

## Preuves de validation

Commandes exécutées contre Supabase local :

### Barrière applicative

```text
npm run check
```

Résultats :

- ESLint : réussi ;
- TypeScript `tsc --noEmit` : réussi ;
- Vitest : 78 fichiers et 463 tests réussis ;
- couverture statements : 95,95 % ;
- couverture branches : 91,76 % ;
- couverture fonctions : 99,13 % ;
- couverture lignes : 98,70 % ;
- build Vite/PWA : réussi.

### Intégration locale

```text
npm run test:integration
```

Résultat : 269 validations réussies, notamment :

- RLS inter-club : 43/43 ;
- modules/reset local : 18/18 ;
- Storage privé : 25/25 ;
- documents : 11/11 ;
- planning : 11/11 ;
- scalabilité 30 athlètes : 11/11.

### Parcours navigateur

```text
npm exec playwright -- test
```

Résultat : 56/56 tests réussis.

Tailles effectivement contrôlées :

- téléphone : `320×568`, `360×800`, `375×812`, `390×844`, `430×932` ;
- tablette : `768×1024`, `820×1180`, `1024×768` ;
- desktop : `1280×800`, `1440×900`.

## Limites et points à surveiller

- Playwright valide le viewport, le scroll, le champ de message et les safe-areas CSS, mais ne reproduit pas exactement le clavier logiciel d'un appareil iOS/Android physique.
- Une validation manuelle sur au moins un iPhone Safari et un Android Chrome reste recommandée avant une diffusion large.
- Le pipeline documentaire est testé fonctionnellement et structurellement. Les tests ne constituent pas un benchmark réseau sous connexion mobile lente ou forte latence réelle.
- Aucun test vert ne garantit l'absence absolue de régression visuelle sur chaque combinaison de contenu utilisateur ; le relecteur doit rechercher les contenus exceptionnellement longs, noms de clubs longs et listes très volumineuses.
- Le build reste vert mais `vite-plugin-pwa` émet un avertissement interne de dépréciation `inlineDynamicImports`; aucun usage de cette option n'existe dans le code du repository.

## Fichiers modifiés dans la passe finale

- `athleteos/src/App.jsx`
- `athleteos/src/AthleteApp.jsx`
- `athleteos/src/index.css`
- `athleteos/src/modules/Messaging.jsx`
- `athleteos/src/modules/Planning.jsx`
- `athleteos/src/modules/planningUtils.js`
- `athleteos/src/modules/planningUtils.test.js`
- `athleteos/src/modules/CreateCompModal.jsx`
- `athleteos/src/athlete/views/AthleteDashboard.jsx`
- `athleteos/src/athlete/views/AthletePlanning.jsx`
- `athleteos/src/athlete/AthleteDashboard.test.jsx`
- `athleteos/src/components/modules/AthleteModulesManager.jsx`
- `athleteos/src/components/planning/PlanningEventModal.jsx`
- `athleteos/e2e/global-setup.mjs`
- `athleteos/e2e/module-ux-priority.spec.js`
- `athleteos/e2e/post-refonte.spec.js`
- `athleteos/dist/sw.js`

Fichiers ajoutés ou modifiés par la passe qualité du 5 septembre :

- `athleteos/e2e/global-setup.mjs`
- `athleteos/src/AthleteApp.jsx`
- `athleteos/src/athlete/views/SessionDetailModal.jsx`
- `athleteos/src/athlete/views/athleteMessaging.js`
- `athleteos/src/athlete/views/athleteMessaging.test.js`
- `athleteos/src/domain/sessionDay.js`
- `athleteos/src/domain/sessionDay.test.js`
- `athleteos/src/modules/AthleteList.jsx`
- `athleteos/src/modules/AthleteList.test.jsx`
- `athleteos/src/modules/Messaging.jsx`
- `athleteos/src/modules/Messaging.test.jsx`
- `athleteos/src/modules/Planning.jsx`
- `athleteos/src/modules/planningUtils.js`
- `athleteos/src/modules/planningUtils.test.js`
- `athleteos/src/services/athleteShellData.js`
- `athleteos/src/services/athleteShellData.test.js`
- `athleteos/src/utils/dateTime.test.js`
- `athleteos/src/utils/supabaseResults.js`
- `athleteos/src/utils/supabaseResults.test.js`
- `athleteos/dist/sw.js` (artefact PWA régénéré par le build local)

## Format de réponse souhaité du relecteur

Merci de répondre avec :

1. verdict global ;
2. points solides confirmés dans le code ;
3. bugs ou incohérences certaines, avec fichiers concernés ;
4. risques classés critique / important / mineur ;
5. tests manquants ;
6. plan de correction minimal, sans nouvelle refonte ni feature creep ;
7. recommandation finale : prêt ou non pour un déploiement de production.
