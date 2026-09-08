# AthleteOS — audit ciblé configuration et commercialisation

Date : 6 septembre 2026

Périmètre : athlétisme uniquement. Les tests/métriques personnalisés et le multisport sont explicitement exclus de ce cycle.

## Décision d'architecture

AthleteOS doit étendre les tables, RPC, services et écrans existants. Aucun des domaines ci-dessous ne justifie un second système parallèle. Les migrations doivent être additives, fournir des valeurs par défaut aux clubs existants et conserver les rôles `head_coach`, `coach`, `athlete`.

## Ordre des lots

1. P0 production/RGPD : export personnel, suppression autonome, confirmation email, validation de déploiement et matrice RLS.
2. Templates de séances V2.
3. Wellness configurable et versionné.
4. Alertes paramétrables utilisant la configuration wellness.
5. Dashboard légèrement configurable.
6. Affectations coach ↔ groupes/athlètes, puis application progressive des permissions.
7. Modèle d'abonnement et droits serveur, puis fournisseur de paiement.

Les lots ne doivent pas être fusionnés dans une migration ou une refonte générale unique.

## 1. Production, sécurité et RGPD

### Existant à conserver

- `supabase/functions/admin-actions/index.ts` : identité obtenue depuis le JWT, matrice d'autorisation, validation, audit et idempotence.
- `20260801160000_transactional_user_removal.sql` : suppression atomique d'un membre par un head coach et protection du dernier responsable.
- `audit_logs` et les tests `test_admin_actions.mjs`.
- RLS durcies par les migrations de juillet/août, RPC transactionnelles et stockage privé.
- Invitations individuelles et inspection publique sans exposition de l'adresse destinataire.
- Push fondée sur les événements de confiance et non sur des destinataires choisis par le navigateur.
- Écran de compte existant dans `src/components/ui/AccountSettingsModal.jsx`.

### Écart réel

- Le signup crée encore des comptes avec `email_confirm: true` en mode pilote. Activer les confirmations sans SMTP et sans adapter création de club/invitations casserait le parcours.
- Il n'existait aucun export personnel autonome.
- Il n'existe pas encore de suppression autonome distinguant : quitter un club, supprimer son compte et supprimer un club.
- La protection intra-club doit être complétée par une matrice négative par table/opération, notamment social et santé.
- Les migrations `20260905000000_trusted_push_outbox.sql` et `20260905010000_messages_realtime_publication.sql` sont signalées comme non déployées dans le dernier suivi local. L'état distant doit être vérifié avant déploiement, pas supposé.
- Les tests E2E authentifiés exigent un environnement/jeu de comptes fiable dans la chaîne de release.
- Sauvegarde, restauration, rétention et suppression différée ne sont pas formalisées comme processus de production.

### Lots réalisés localement

- Action `export_personal_data` ajoutée à `admin-actions`, accessible à tous les rôles authentifiés.
- Périmètre calculé exclusivement depuis le JWT ; les identifiants envoyés par le client sont ignorés.
- Collecte paginée par blocs de 500, au-delà du plafond PostgREST de 1 000 lignes.
- Export JSON versionné depuis les réglages du compte.
- Données internes Push et données tierces sans rapport exclues.
- Action auditée sans écrire le contenu exporté dans `audit_logs`.
- Test réel Supabase : l'athlète obtient son wellness et sa conversation, jamais une conversation tierce.
- Suppression autonome ajoutée avec confirmation par l'adresse exacte du compte.
- Le dernier `head_coach` ne peut pas supprimer son compte avant transfert de responsabilité.
- Le contenu sportif créé par un coach est transféré à un responsable ; ses conversations privées sont supprimées.
- La suppression administrative existante réutilise désormais ce transfert et ne bloque plus sur les FK d'un coach ayant créé du contenu.
- La suppression autonome ne supprime jamais le club et ne constitue pas un mécanisme de suppression de club.

### Prochains changements P0

- Ajouter une ré-authentification récente obligatoire lorsque Supabase Auth fournit le parcours de challenge retenu.
- Formaliser la durée de conservation des sauvegardes après une suppression explicite.
- Ajouter un parcours `pending_email_confirmation` compatible avec club, coach invité, athlète invité et mot de passe oublié.
- Ajouter un contrôle de parité migrations/fonctions au pipeline de promotion.
- Compléter les tests RLS same-club et les tests de stockage par propriétaire.

### Risques et tests

- Risque de fuite inter-utilisateur dans l'export : test avec identifiants client injectés et conversation tierce.
- Risque de suppression orpheline : test transactionnel DB + échec simulé du nettoyage Auth.
- Risque de blocage du signup : tests confirmation, invitation, reprise après confirmation et liens expirés.
- Aucun basculement de configuration Auth distante ne doit être réalisé sans SMTP validé et smoke test.

## 2. Templates de séances V2

### Existant à conserver

- Table `session_templates`, champs sportifs actuels et `created_by`.
- RPC `save_session_template` et `create_session_from_template`.
- Documents associés via `session_template_documents`.
- Sauvegarde d'une séance depuis `src/modules/Planning.jsx`.
- Application rapide d'un modèle dans `src/modules/AddSessionModal.jsx`.

### Écart réel

- Pas de véritable bibliothèque de gestion : édition, duplication, suppression, recherche et filtres.
- Pas de catégories/tags de bibliothèque distincts du contenu sportif.
- `UNIQUE (club_id, name)` empêche une sémantique propre entre modèles personnels et partagés.
- La création directe d'un template et la gestion de sa visibilité ne sont pas exposées.
- L'application aux groupes repose sur le formulaire de séance, sans parcours explicite depuis la bibliothèque.

### Lot réalisé localement

- `session_templates` est étendue avec `scope` (`personal`/`club`) et `tags text[]`, sans seconde table ni éditeur parallèle.
- Les modèles existants restent inchangés et deviennent des modèles club par défaut.
- L'unicité distingue désormais les noms partagés du club et les noms personnels de chaque coach.
- La lecture RLS masque les modèles personnels des autres coachs. Les mutations directes sont révoquées au profit de RPC contrôlées.
- RPC ajoutées : création/édition, duplication personnelle et suppression. Le RPC historique de sauvegarde et la création depuis un modèle restent compatibles.
- Un coach peut gérer ses modèles ; le head coach peut administrer les modèles club, mais ne peut pas privatiser le modèle d'un autre coach.
- La bibliothèque intégrée à « Nouvelle séance » permet recherche, filtres catégorie/portée, tags, création depuis le brouillon, application, édition, duplication et suppression.
- Les documents restent associés via `session_template_documents` et sont validés comme appartenant au club.

### Validations exécutées

- Migration appliquée uniquement à Supabase local.
- 14/14 validations planning réelles, dont isolation personnel/club, droits auteur/head coach, duplication, suppression et compatibilité du RPC historique.
- 10/10 tests unitaires/composants ciblés.
- Suite Vitest complète : 91 fichiers et 528 tests réussis.
- Spec E2E UX complète : 44 parcours réussis, dont la bibliothèque à 320, 375, 768 et 1 440 px sans débordement.
- Lint, typecheck et build de production réussis.
- Aucun déploiement distant effectué.

## 3. Wellness configurable

### Existant à conserver

- Table `athlete_wellness` et ses cinq colonnes historiques.
- `WELLNESS_QUESTIONS` et le questionnaire mobile existant.
- Unicité athlète/date, notes, score V1 et consommateurs dans Dashboard, Charge, Rapports et compétitions.
- Activation club/athlète via le module `wellness`.

### Écart réel

- Questions, ordre, caractère obligatoire et jours fixes dans le code.
- Aucun snapshot n'indique quelle configuration était active au moment d'une réponse.
- Le score 0–100 suppose exactement les cinq dimensions historiques.
- Pas de politique de visibilité distincte pour les réponses sensibles.

### Lot réalisé localement

- `wellness_questionnaire_versions` conserve des versions immuables par club avec ordre, caractère obligatoire, jours actifs et visibilité `staff`/`head_coach`.
- Bibliothèque fermée de 12 questions AthleteOS ; aucun constructeur de formulaire ou métrique personnalisée n'a été créé.
- Le preset actuel de cinq questions reste le comportement virtuel par défaut : aucun club existant n'a besoin d'une initialisation manuelle.
- `athlete_wellness` est étendue avec `questionnaire_version_id` et `answers jsonb`, tout en continuant à remplir `sleep`, `energy`, `soreness`, `mood` et `stress` lorsqu'elles sont présentes.
- Les anciennes réponses sans version restent définitivement interprétées avec le preset V1, même après activation d'une nouvelle configuration.
- Les nouvelles écritures passent par une RPC versionnée ; l'athlète ne peut soumettre que son propre questionnaire et le garde-fou des modules reste actif.
- La visibilité configurée est appliquée en RLS. L'athlète voit toujours ses réponses ; un questionnaire `head_coach` est masqué aux coachs simples.
- Le head coach configure le questionnaire dans Réglages → Outils. L'athlète reçoit le bon ordre, les questions facultatives et uniquement les sollicitations automatiques des jours choisis.
- Les réponses configurées sont visibles séparément côté athlète et dans le dashboard coach.
- Le score historique `/100` n'est calculé que si ses cinq dimensions existent ; un questionnaire complété sans ces cinq dimensions est reconnu comme complété, sans score artificiel.

### Validations exécutées

- 9/9 validations Supabase réelles : preset historique, autorisation head coach, snapshot immuable, obligations, colonnes V1, visibilité et catalogue fermé.
- Régressions RLS : 43/43 ; régressions modules/reset : 18/18, dont écriture wellness refusée lorsque le module est désactivé.
- Tests unitaires/composants ciblés : questionnaire coach, formulaire athlète, jours, score absent et état quotidien.
- Suite Vitest complète : 94 fichiers et 537 tests réussis.
- 48/48 cas de la spec UX affichés comme réussis, dont la configuration Wellness à 320, 375, 768 et 1 440 px. Le processus Playwright a nécessité une interruption après la fin des cas à cause de la fermeture du serveur preview sous Windows.
- Lint, typecheck et build de production réussis.
- Aucun déploiement distant effectué.

## 4. Alertes configurables

### Existant à conserver

- Table `alerts`, états de résolution/archivage et `alert_read_states`.
- Notifications, badges, temps réel et Push.
- Cycle de vie dans `src/domain/alertLifecycle.js` et écran `src/modules/Alerts.jsx`.
- Filtrage des écritures selon les modules actifs.

### Écart réel

- Seuils et déclencheurs répartis dans le code.
- Aucune définition persistée de la règle ayant déclenché une alerte.
- Pas de paramétrage club des destinataires, groupes, durée ou gravité.

### Modification proposée

- Une bibliothèque fermée de clés de règles AthleteOS dans le domaine, pas un langage de règles.
- Table `club_alert_rules` avec clé, activation, paramètres bornés, population, gravité et destinataires.
- Colonnes additives dans `alerts` : `rule_key`, `rule_version`, `trigger_data jsonb`.
- Génération serveur idempotente respectant `club_modules` et `athlete_modules`.
- Texte explicatif descriptif ; aucun diagnostic ou prescription automatique.

### Tests

- Validation stricte des paramètres par type de règle.
- Non-génération si le module requis est désactivé.
- Isolation club/groupe et déduplication.
- Traçabilité de la valeur, de la date et de la règle déclenchante.

### Implémentation locale du lot 4 — 8 septembre 2026

- `club_alert_rules` et RPC de lecture/configuration : sept règles fermées, bornes contrôlées en SQL, version incrémentée seulement si les paramètres changent, configuration réservée au responsable.
- Réglages dans **Outils → Règles du club** : activation, seuil/durée, groupe, gravité et destinataires. Les nouvelles règles sont désactivées par défaut ; les modules et notifications historiques restent actifs selon leurs réglages existants.
- `evaluate_club_alert_rules` calcule côté serveur les conditions et écrit dans `alerts`. L’accueil, l’écran Alertes et la tâche quotidienne existante déclenchent cette même fonction.
- Wellness manquant : jours demandés et terminés depuis l’activation, sans compter la journée en cours. Une réponse du jour interrompt cet épisode.
- Sommeil/courbatures : réponses successives, dernière réponse datant de sept jours maximum et échantillon sur quatorze jours maximum. Une réponse facultative absente interrompt la série. Ce paramètre est présenté comme un nombre de réponses, pas comme des jours consécutifs.
- Feedback/RPE : la plus ancienne séance réalisée (`done`/`partial`) sans retour dans les trente derniers jours est signalée. Les présences non confirmées et absences ne sont pas assimilées à un feedback manquant.
- Compétition : prochaine compétition de l’athlète, nombre de séances affectées avant sa date comparé au minimum configuré.
- Charge : sept jours terminés comparés à deux à six semaines antérieures ; toutes les journées doivent être complètes ou explicitement déclarées en repos. Les durées estimées et journées inconnues empêchent le signal. Au maximum un signal par règle/version, athlète et semaine ISO.
- Historique conservé : snapshots `rule_key`, `rule_version`, `trigger_data`, provenance lisible et réponses déclenchantes consultables. Pas de réouverture automatique d’une alerte traitée ; verrou transactionnel et clé unique contre les doublons.
- Une réponse wellness privée impose des destinataires privés, même si la règle demande « tous les coachs ». Lecture RLS, RPC de lecture/résolution et Push appliquent cette restriction. Provenance et contenu des alertes automatiques protégés contre la modification directe.
- Extension de l’outbox Push existante : texte discret fourni par le serveur, revalidation de la règle/version, du module, de la résolution et des destinataires lors de la réservation. Livraison quotidienne par lots et reprise pendant sept jours pour ces nouveaux événements.
- Les rappels historiques de compétition, récapitulatifs et rapports restent distincts des sept nouvelles règles ; leurs comportements ne sont pas réécrits dans ce lot.
- Un échec du calcul des nouvelles alertes affiche un avertissement non bloquant sur l’accueil et dans le centre d’action : les données déjà enregistrées restent consultables.
- Réglages mobile/desktop : hauteur de contenu bornée, contrôles de type interrupteur positionnés dans leur conteneur et focus clavier visible. Le défilement conserve l’en-tête et la fermeture à l’écran ; les tests vérifient leur présence réelle dans le viewport après enregistrement.

Déploiement requis, **non effectué** : appliquer les quatre migrations `20260907010000` à `20260907013000` après le lot wellness, déployer `send-push` (nouveaux modèles partagés) puis `session-reminders`, et enfin le frontend. La tâche quotidienne déjà configurée reste le point d’entrée ; aucun nouvel appel distant n’est ajouté par ces migrations.

Validation locale : 28 scénarios SQL spécifiques aux règles, 4 scénarios de cycle de vie des alertes, 43 contrôles RLS, 18 contrôles de configuration des modules et 5 scénarios de transactions Push réussis. Les 54 parcours UX passent sur le build local : parcours mobile/desktop de 320 à 1440 px et deux scénarios d’indisponibilité du calcul des alertes. Lint, typecheck et build réussis. Aucun déploiement distant effectué ; l’artefact suivi `dist/sw.js` généré pendant les tests est restauré sans toucher aux sources.

La suite unitaire/composants a réussi avec 97 fichiers et 548 tests (`npm exec vitest -- run --pool=forks --maxWorkers=2`) avant les derniers correctifs de défilement et d’avertissement non bloquant. Une relance complète après ces correctifs n’a plus progressé dans l’environnement local et a été interrompue ; elle ne constitue pas une seconde validation. Les 54 tests navigateur, le typecheck et le build ont, eux, réussi après ces correctifs. Le mode de workers `forks` avait permis la première validation sans réduire la suite, après un blocage du mode threads.

Après l’interruption de cette relance, les trois fichiers ciblés `alertRules.test.js`, `AlertRulesSettings.test.jsx` et `sessionRemindersHandler.test.js` ont été réexécutés avec un seul worker `forks` : **11 tests réussis** en 19 secondes.

Le lot dashboard a ensuite été implémenté et retesté le 8 septembre (voir ci-dessous). Les affectations et l’abonnement restent des lots séparés, non implémentés dans cette passe.

## 5. Dashboard légèrement configurable

### Existant à conserver

- Dashboard orienté action dans `src/modules/Dashboard.jsx`.
- Masquage conditionnel déjà lié aux modules.
- File de priorités, état quotidien, compétitions, objectifs et séances.

### Écart réel

- Ordre et visibilité des blocs non mémorisés par coach.
- Groupe et période par défaut non persistés.
- Certaines données sont chargées largement puis agrégées dans le navigateur.

### Modification proposée

- Ajouter des préférences JSON bornées au profil utilisateur, ou une table unique `user_preferences` si d'autres écrans en ont besoin.
- Autoriser seulement les cartes connues, un ordre contrôlé, un groupe par défaut et une période valide.
- Le rendu conserve toujours une disposition AthleteOS cohérente.
- Une carte dépendante d'un module désactivé reste invisible, même si une ancienne préférence la référence.

### Tests

- Validation/normalisation des préférences inconnues ou obsolètes.
- Valeurs par défaut identiques au dashboard actuel.
- Configurations de modules partielles et responsive.

### Lot réalisé localement — 8 septembre 2026

- Le dashboard coach existant est conservé : quatre blocs fermés (`priorities`, `wellness`, `overview`, `followup`) et quatre cartes de suivi (`athletes`, `competitions`, `goals`, `feedback`). Aucune bibliothèque de widgets ou métriques arbitraires.
- « Personnaliser mon accueil » permet de masquer/réafficher et réordonner les blocs avec des boutons accessibles au clavier. L’ordre change réellement dans le DOM, pas seulement visuellement. Les cartes du suivi peuvent être masquées individuellement.
- Les préférences sont personnelles au coach, et non communes au club. Migration additive `20260908010000_coach_dashboard_preferences.sql`, table privée à clé utilisateur, lecture RLS propriétaire et deux RPC contrôlées. La table séparée évite de placer ces réglages dans le profil utilisateur lisible par les autres membres du club.
- Validation serveur du catalogue, de l’ordre, du groupe appartenant au club et des périodes autorisées. Ni athlète ni navigateur anonyme ne peuvent utiliser ces RPC ; les écritures directes sont interdites. Un responsable ne lit pas les préférences d’un autre coach.
- Groupe par défaut mémorisé ; sélection temporaire disponible directement sur l’accueil. Les effectifs, séances partagées, validations, charge, wellness, blessures, objectifs, compétitions et alertes sont filtrés ensemble. Les alertes générales du club restent visibles et cette exception est expliquée dans les réglages.
- Les modules restent prioritaires sur les préférences. Les feedbacks/objectifs/compétitions et le dénominateur wellness respectent aussi les modules individuels. Le filtrage par groupe est un filtre de présentation, **pas une nouvelle permission ni une affectation coach**.
- Période mémorisée uniquement là où elle est pertinente : feedbacks des 7, 14 ou 28 derniers jours. Le wellness reste celui du jour et les indicateurs hebdomadaires ceux de la semaine en cours. L’ancien intitulé ambigu « Synthèse de la semaine » devient « Wellness du jour ».
- La limite d’affichage de trois compétitions est appliquée après le filtrage du groupe, pour ne pas perdre une compétition du groupe choisi derrière celles des autres groupes.
- Absence de préférences : disposition historique. Groupe supprimé/changement de club : repli sûr et explicite. Panne de lecture : accueil par défaut, non bloqué. Panne de sauvegarde : brouillon conservé, aucun faux succès. Annulation et réinitialisation explicites.
- Les préférences sont incluses dans l’export personnel existant et supprimées par cascade avec le compte. Le test réel d’export vérifie qu’aucune préférence tierce ne fuit.
- Tests ajoutés à la commande d’intégration et au pipeline CI, avec les validations wellness/alertes des lots précédents.

Déploiement requis, **non effectué** : appliquer cette migration après les migrations précédentes, déployer `admin-actions` mis à jour pour l’export, puis le frontend. Aucune configuration Auth, aucun abonnement et aucune affectation de coach ne sont modifiés par ce lot.

### Vérification globale après le dashboard

- **99 fichiers / 555 tests unitaires et composants réussis**, suite entière sans réduction (`npm exec vitest -- run --pool=forks --maxWorkers=2 --reporter=verbose`, 228 s). Une première tentative avec un seul worker ne progressait plus et a été interrompue ; la relance complète à deux workers a terminé.
- **138 tests E2E réussis**, suite entière avec `E2E_WITH_AUTH=1`, build pointant uniquement sur Supabase local et vrais comptes de test pour les parcours authentifiés (3,2 min). Les nouveaux tests dashboard couvrent 320, 375, 768 et 1 440 px, la persistance après rechargement, les modules désactivés, l’annulation, l’échec de sauvegarde et le groupe supprimé.
- **19 suites d’intégration exercées** : RLS, modules/reset, signup, Push, transactions Push, administration/export/suppression, import, parité charge, parité axes, compétitions, stockage privé, documents, planning/templates, wellness, alertes configurables, dashboard, cycle de vie des alertes, scénario 30 athlètes et normalisation des performances.
- La première passe donne 18 suites réussies sur 19. La suite HTTP Push échoue faute de clés VAPID locales (503), avec aussi une interruption de worker (546). Après redémarrage du runtime local avec les **clés éphémères générées par le script CI existant**, Push réussit **17/17**. Aucun correctif métier Push ni assouplissement de sécurité n’a été nécessaire.
- Avec `SIGNUP_TEST_MODE=true` localement, signup réussit **15/15**, y compris les deux contrôles de compensation auparavant ignorés. Administration/export/suppression réussit **41/41**, dont l’export des préférences dashboard privées.
- Dashboard SQL/RLS : **26/26** ; alertes paramétrables : **28/28** ; wellness : **9/9** ; planning/templates : **14/14** ; RLS générales : **43/43** ; modules/reset : **18/18** ; stockage privé : **25/25**.
- Lint, typecheck, build et `git diff --check` réussis. Les captures suivies et le service worker modifiés uniquement par les tests sont restaurés ; les preuves de cette passe restent dans les artefacts locaux ignorés de Git.
- Ces tests ne valident pas la livraison Push sur un téléphone réel, le SMTP distant, la restauration d’une sauvegarde de production ou la parité du déploiement distant. Aucun déploiement en production n’a été réalisé.
- Nettoyage E2E final : les quatre clubs temporaires du run `1788871825774` (315–318) et leurs sept comptes Auth ont été supprimés après vérification de leurs identités. Le fichier local de connexion temporaire a été retiré. Aucune donnée d’un autre club n’est ciblée ; ces fixtures peuvent être recréées par le setup E2E.

### Position par rapport au prompt initial

| Chantier | État après cette passe | Reste réel |
| --- | --- | --- |
| 1. Production / sécurité / RGPD | Partiel : export et suppression autonomes implémentés et retestés, protections existantes conservées | Confirmation email/SMTP, ré-authentification sensible, rétention, restauration vérifiée et parité du déploiement distant |
| 2. Templates V2 | Implémenté et validé localement | Déploiement et validation d’usage avec des coachs |
| 3. Wellness configurable | Implémenté et validé localement, bibliothèque contrôlée et historique versionné | Déploiement ; questions arbitraires non ajoutées, possibilité optionnelle non retenue |
| 4. Alertes configurables | Implémenté et validé localement | Déploiement coordonné SQL/Edge/frontend et essai Push réel |
| 5. Dashboard configurable | Implémenté et validé localement | Déploiement ; les requêtes métier restent en partie larges et agrégées côté navigateur |
| 6. Affectations coach/groupes | Non implémenté | Relations coach/groupes/exceptions et permissions progressives |
| 7. Abonnement du club | Non implémenté | Essai, statuts, quotas, lecture seule et gardes backend ; paiement séparé ensuite |

Le périmètre demeure **athlétisme uniquement**. Aucun constructeur de métriques, moteur no-code, diagnostic ou entraînement automatique. Aucun chantier 6 ou 7 commencé : arrêt volontaire après dashboard et vérification globale, conformément à la demande.

## 6. Affectations coach ↔ groupes/athlètes

### Existant à conserver

- Rôles `head_coach`, `coach`, `athlete`.
- `athletes.group_name`, utilisé dans les filtres, le planning et les modules.
- Supervision club du head coach.
- Invitations et actions de changement de rôle existantes.

### Écart réel

- Aucun parcours UI complet d'invitation d'un coach.
- Aucun lien persistant coach ↔ groupe ou exception individuelle.
- Les coachs ont généralement une vision club très large, y compris sur des données sensibles.

### Modification proposée

- Ne pas normaliser tous les groupes dans ce lot : utiliser d'abord `group_name` comme clé métier rétrocompatible.
- Ajouter `coach_group_assignments(club_id, coach_user_id, group_name)`.
- Ajouter `coach_athlete_assignments(club_id, coach_user_id, athlete_id)` pour les exceptions.
- Head coach global par définition.
- Ajouter l'invitation coach au système `club_invitations` existant avec rôle cible contrôlé.
- Appliquer les restrictions progressivement, domaine par domaine, après ajout des tests RLS.

### Tests

- Inter-club et intra-club, changement de groupe, suppression du coach et exception individuelle.
- Head coach toujours global.
- Absence de régression tant que le filtrage strict n'est pas activé pour un domaine.
- Tests spécifiques santé/wellness avant toute restriction en production.

## 7. Abonnement et contrôle d'accès

### Existant à conserver

- Le club est déjà la racine de presque toutes les données.
- Les modules donnent un premier vocabulaire d'entitlements.
- Le head coach possède déjà les actions structurelles.

### Écart réel

- Aucun plan, essai, abonnement, quota, période de grâce ou fournisseur de paiement.
- Aucun garde backend sur le nombre d'athlètes/coachs ou l'écriture après expiration.
- La création de club ne limite pas aujourd'hui la multiplication des espaces gratuits.

### Modification proposée

- Ajouter un modèle indépendant du fournisseur : `subscription_plans`, `club_subscriptions`, `billing_events`.
- États minimaux : `trialing`, `active`, `past_due`, `grace_period`, `read_only`, `canceled`.
- RPC centrale `get_club_access_state` et gardes partagées utilisées par les RPC d'écriture sensibles.
- Quotas contrôlés côté serveur à la création d'athlète et à l'invitation coach.
- Les clubs existants reçoivent un état transitoire explicite qui ne bloque rien lors de la migration.
- Stripe ou un autre fournisseur ne met à jour l'état qu'au travers de webhooks idempotents ; aucune logique fournisseur dispersée dans l'UI.
- À expiration : lecture et export conservés, écritures bloquées avec message explicite, aucune suppression.

### Tests

- Transitions d'état, horodatage d'essai, grâce, quotas concurrents et rejeu de webhook.
- Impossibilité de contourner un quota par appel API direct.
- Export toujours accessible en lecture seule.
- Migration sans blocage des clubs historiques.

## Éléments à ne surtout pas réécrire

- Le système de modules club/athlète.
- Les disciplines et performances officielles d'athlétisme.
- Le planning, les séries et les RPC transactionnelles.
- `session_templates` et les associations documentaires.
- `athlete_wellness` et les cinq dimensions historiques.
- `alerts`, `alert_read_states` et leur cycle de vie.
- Les rôles existants.
- `admin-actions`, les invitations, l'audit et la protection du dernier head coach.
- L'outbox Push de confiance et les destinations déterminées côté serveur.
- Les protections RLS déjà correctes.

## Définition de fini commune à chaque lot

- Migration additive et rétrocompatible lorsque nécessaire.
- Tests unitaires et de composants.
- Tests Supabase réels pour les transactions.
- Tests RLS dès qu'une permission change.
- Lint, typecheck et build.
- E2E ciblé mobile/desktop.
- Documentation de déploiement et distinction explicite entre état local et état distant.
