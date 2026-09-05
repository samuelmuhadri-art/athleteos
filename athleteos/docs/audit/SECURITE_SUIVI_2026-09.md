# Suivi de l'audit sécurité et fiabilité — septembre 2026

## Périmètre de ce lot

Le logo Piste 03 est dans le commit `795d80e`. Ce lot poursuit l'audit fourni par le propriétaire. Il ne modifie aucun modèle scientifique, aucune donnée historique, aucune policy RLS existante ni l'architecture multi-club. Une nouvelle table de sortie Push est inaccessible aux rôles navigateur.

| Point de l'audit | État du code | Correction / limite |
| --- | --- | --- |
| Push arbitraire (P1) | Corrigé, déploiement serveur requis | Événements transactionnels persistés ; texte et destinataires calculés côté serveur. Payloads libres des anciens navigateurs ignorés, sans casser leurs appels. |
| E-mail préconfirmé (P1 avant ouverture publique) | Non modifié | Le mode pilote reste actif. SMTP et parcours de confirmation doivent être validés avant une inscription publique. Ne pas simplement passer `email_confirm` à false : la création admin actuelle n'est pas un parcours d'envoi de confirmation. |
| Aperçu privé dans les Push (P1/P2) | Corrigé | Messages, notes de présence et légendes ne sont plus repris dans les Push navigateur ; modèles serveur statiques pour les événements utilisateurs. Les informations détaillées restent consultables dans l'application. |
| Messagerie coach obsolète (P1/P2) | Corrigé, publication serveur requise | INSERT/UPDATE filtrés, fusion sans doublon, rattrapage à la reconnexion et à la disponibilité de la réplication, brouillon préservé, erreur de synchronisation visible. |
| Permission Push automatique (P2) | Corrigé | Demande uniquement après activation explicite. Bouton accessible sur mobile et grands écrans. |
| Historique `replace` (P2) | Corrigé | Remplacement de la route interdite, sans boucle au Retour ; coach et athlète. |
| Sur-chargement du shell athlète (P2) | Réduit, non terminé | Séances, compétitions et événements filtrés par participation côté serveur. Chargement à la demande et pagination temporelle restent à réaliser. Historique personnel non tronqué pour préserver calculs et vues. |
| Historique complet des messages coach (P2) | Non terminé | Le Realtime n'est pas une pagination. Il reste à introduire résumés par conversation, curseurs et recherche serveur sans perdre l'accès aux anciens messages. |
| Frontières TypeScript (P2) | Amélioré, non global | Types régénérés depuis le schéma local, client Supabase typé, service de données athlète en `@ts-check`. Les composants JS ne deviennent pas tous strictement vérifiés. |
| Décalage frontend/backend (P1 avant lancement) | Procédure préparée, réglages externes requis | Ordre manuel ci-dessous ; protection de main et blocage du déploiement Vercel non configurés par ce lot. |

## AVANT → APRÈS des parcours modifiés

| Parcours | Avant → Après | Étapes / impact | Fichiers principaux |
| --- | --- | --- | --- |
| Lire une réponse côté coach | Vue inchangée jusqu'au rechargement → réponse ajoutée et lecture synchronisée | Un rechargement manuel supprimé quand le canal fonctionne | `src/modules/Messaging.jsx`, `src/hooks/useMessageRealtime.js` |
| Première visite athlète | Permission navigateur déclenchée au montage → choix explicite d'activer les notifications | Une interruption imposée supprimée ; activation volontaire conservée | `src/AthleteApp.jsx`, `src/components/pwa/PushToggleButton.jsx` |
| Retour après accès à un outil désactivé | Route interdite empilée → route remplacée | Un passage inutile par la route interdite supprimé | `src/hooks/useUrlView.js`, `src/AthleteApp.jsx` |
| Recevoir une notification privée | Extrait lisible sur écran verrouillé → texte générique | Aucun clic supplémentaire pour consulter la conversation dans l'application | `src/utils/notifications.js`, `supabase/functions/_shared/pushOutbox.ts` |
| Ouvrir l'espace athlète | Parents du club téléchargés puis filtrés → parents filtrés sur le serveur | Même parcours, moins de données ; pas de réduction de clic revendiquée | `src/services/athleteShellData.js`, `src/AthleteApp.jsx` |

## Validation et limites

Validation locale finale du 5 septembre 2026 : 85 fichiers / 492 tests unitaires verts, 52 scénarios Playwright verts, 17 contrôles Push et 5 scénarios transactionnels verts ; suite d'intégration existante complète, lint, typecheck et build réussis. Le build de vérification est écrit dans `node_modules/.cache/security-build` pour ne pas modifier les artefacts suivis. La CI distante et le smoke production ne sont pas couverts par ces résultats locaux.

Tests dédiés : `test_send_push_regression.mjs` (17 contrôles), `test_push_outbox_transactions.mjs` (5 scénarios réels, instance locale uniquement), tests unitaires des hooks, de la messagerie, des modèles Push et du service de données. La suite transactionnelle est ajoutée au quality gate CI.

Playwright : `security-followup.spec.js`, `ux-simplification.spec.js` et `brand-integration.spec.js`, soit 52 scénarios, couvrent notamment 320×568, 768×1024 et 1440×900. Ces tests d'interface utilisent des fixtures ; le test transactionnel séparé vérifie une vraie livraison Realtime avec authentification locale. Aucun envoi vers un fournisseur Push réel n'est nécessaire aux tests.

La suite d'intégration existante, les tests unitaires, lint, typecheck et build sont conservés. Un passage vert ne garantit pas une absence absolue de régression ni la livraison d'une Push sur tous les téléphones.

La sortie Push garde le déclenchement HTTP du client pour vider les événements de son acteur, et le chemin serveur existant pour les crons. Ce n'est pas encore un worker autonome : sans appel ou après épuisement des reprises, une Push peut manquer, alors que l'événement métier reste sauvegardé. Les claims sont exclusifs, limités à 20 événements et trois tentatives, avec bail de deux minutes et fenêtre de 24 heures. Une reprise après livraison partielle peut renvoyer une Push ; aucune garantie « exactement une fois » auprès du fournisseur n'est revendiquée. Les compteurs d'échecs fournisseur restent best-effort, comme auparavant.

## Release manuelle (à exécuter uniquement après validation de l'environnement cible)

1. Choisir le SHA et l'environnement ; attendre le quality gate complet. Vérifier sauvegarde et plan de retour. Aucun secret dans Git ou Repomix.
2. Appliquer d'abord les migrations additives `20260905000000_trusted_push_outbox.sql` et `20260905010000_messages_realtime_publication.sql` sur staging. Ne modifier aucune policy existante.
3. Publier `send-push` et son helper partagé. Vérifier les secrets VAPID existants sans les afficher. Une fonction publiée sans sa migration doit échouer fermée, jamais réaccepter du contenu navigateur libre.
4. Smoke staging : vrai message coach↔athlète, deux onglets Realtime, séance avec plusieurs participants, module désactivé, appel libre sans événement (zéro Push), rappel légitime, tentative inter-clubs. Vérifier aussi le chemin cron et un abonnement de test réel.
5. Déployer le frontend du même SHA ; contrôler connexion, inscription pilote, consentement Push et Retour sur mobile/tablette/desktop. Les anciens frontends sont compatibles avec le nouveau serveur ; le nouveau frontend n'appelle pas de nouvelle RPC obligatoire.
6. Après accord explicite pour production, répéter migration → fonction → smoke → frontend. Le push Git n'exécute pas ces opérations Supabase.
7. Avant ouverture publique, exiger le quality gate comme contrôle obligatoire de main et configurer la promotion Vercel pour respecter cet ordre. Ces réglages de comptes externes restent à faire. Un déploiement automatique depuis main ne constitue pas à lui seul un contrôle de release.

Retour : on peut revenir au frontend précédent en conservant les migrations additives et le serveur durci. Ne pas revenir au `send-push` permissif pour résoudre un incident de livraison ; désactiver temporairement les Push si nécessaire, garder la messagerie en base et analyser les journaux sans contenu privé. Ne pas supprimer les tables métier ou l'historique.

## Prochain lot

Pagination des conversations avec recherche dans l'historique, puis séparation du chargement des vues athlète et de leurs besoins scientifiques. Préparer ensuite le parcours de vérification d'adresse avec SMTP confirmé et les réglages de release autorisés. Ces points ne sont pas présentés comme achevés dans ce lot.
