# AthleteOS — mise en service, sept lots

Périmètre demandé le 8 septembre 2026 : athlétisme uniquement, parcours simples sur mobile et ordinateur. Aucun ajout de paiement dans ces sept lots. Les modifications étrangères à ce travail sont conservées.

## Suivi

| Lot | Travail | État et condition de clôture |
| --- | --- | --- |
| 1 | Smoke tests production | Sondes publiques 9/9 réussies les 8 et 9 septembre. Recette authentifiée et des nouveaux parcours en production encore à effectuer après déploiement. |
| 2 | Confirmation email et SMTP | Parcours et renvoi implémentés ; compensation et activation incohérente testées sur le handler réel avec dépendances simulées (6 tests). Envoi réel non actif : fournisseur SMTP et domaine manquants. Pilote conservé par défaut. |
| 3 | Ré-authentification | Contrôle récent côté serveur pour export, suppression, rôle, rotation du code et invitation coach ; fenêtre accessible, annulation et réessai unique testés. Email/password : vérification depuis le compte ; sécurité native Auth à configurer contre les appels directs. |
| 4 | Sauvegarde, restauration, monitoring | Restauration SQL locale réussie : 85 tables et nombre de policies comparés. Sondes planifiées et filtrage des rapports Sentry préparés. Supabase distant ne liste aucune sauvegarde et PITR désactivé ; fichiers Storage, destination chiffrée, projet Sentry et alertes opérationnelles restent à finaliser. |
| 5 | Pages légales / données personnelles | Trois notices pilote accessibles sans connexion et depuis le compte, testées de 320 à 1440 px. Identité de publication, statut, durées et cadre santé/mineurs à valider. Aucune adresse personnelle publiée automatiquement. Ce n’est pas une politique commerciale finale. |
| 6 | Onboarding et invitations coach | Invitations nominatives coach ajoutées au système existant, réservées au head coach. Pas de profil athlète parasite, pas de promotion implicite d’un athlète existant. Capacité serveur vérifiée pour les déploiements progressifs. Parcours historiques conservés. |
| 7 | Affectations coach–groupes/athlètes | Affectations organisationnelles additives + filtre « Mes athlètes ». Validation du club/rôle, version concurrente, audit et cascades. Head coach global. Ce lot ne change pas la confidentialité intra-staff ; ne pas le présenter comme un filtrage RLS strict des dossiers sportifs. |

## État distant déjà établi avant ce travail

- Commit `b6083d6` poussé sur `main`, frontend Vercel observé en HTTP 200 avec le bon projet Supabase.
- Onze migrations appliquées, jusqu’à `20260908010000_coach_dashboard_preferences.sql` ; parité des versions locales/distantes vérifiée après application.
- Cinq fonctions Edge actives : signup, admin-actions, send-push, session-reminders, weekly-cron.
- Sauvegarde **du schéma public uniquement** réalisée avant cette migration. Ce n’est pas une sauvegarde complète ni un exercice de restauration.
- Recette complète en production non encore effectuée. Les validations locales précédentes ne suffisent pas à la déclarer terminée.

## Validation de chaque livraison

Tests unitaires/composants, contrôles des permissions dès qu’elles changent, intégration Supabase locale, lint/typecheck/build, parcours mobile/desktop pertinents. Rapporter séparément : implémenté, testé localement, déployé, testé en production, configuration externe restante. Ne jamais promettre « aucune régression » sans cette distinction.

## Reprise du 9 septembre — validations et corrections

- Les 20 suites d’intégration Supabase locale ont passé leurs contrôles : permissions, modules, inscription, Push, transactions, administration, nouveaux lots, import, charge, axes, compétitions, fichiers, distribution documentaire, planning, wellness, alertes, dashboard, cycle de vie des alertes, 30 athlètes et performances. Un arrêt natif Node/Windows après la suite axes a nécessité de relancer celle-ci puis les dix dernières suites ; relance terminée avec code de sortie 0.
- Parmi ces suites : **47/47** contrôles admin-actions, **15/15** inscription, **43/43** permissions, **30** nouvelles migrations et **26** préférences dashboard. Les jeux de données temporaires sont nettoyés par les scripts.
- Suite unitaire générale : **105 fichiers / 577 tests réussis**. Après le dernier correctif de positionnement du dashboard, les deux suites directement concernées ont été rejouées : **8/8** tests, dont un nouveau test de montage hors du conteneur animé.
- Première recette navigateur élargie : **103/104** réussis. Le défaut réel trouvé sur le dashboard 1440 px venait de son ancêtre animé transformé : le dialogue fixe était positionné relativement à la page au lieu de la fenêtre, et le bouton Enregistrer sortait de l’écran. Correction limitée à `DashboardSettings`, rendu dans un portail sous `document.body`. Le test de visibilité n’a pas été affaibli.
- Les **12 nouveaux parcours** ont passé sur 320, 375, 768 et 1440 px : notices publiques, ré-authentification, clavier et affectations persistantes. Les appels métier sont simulés dans ces tests d’interface ; ce ne sont pas des tests de production.
- Navigation clavier de la ré-authentification corrigée : le champ technique destiné au gestionnaire de mots de passe n’entre plus dans la boucle de focus. Export présenté comme une action neutre, distincte de la suppression.
- Après correction, les **19/19** scénarios dashboard et nouveaux lots ont repassé avec sortie 0, dont le scénario 1440 px précédemment en échec. Cette relance couvre les quatre tailles d’écran et conserve le contrôle de visibilité du bouton Enregistrer.
- Lint, typecheck et build réussis le 9 septembre, y compris après le correctif dashboard. Aucun échec fonctionnel restant dans les suites exécutées ; cela ne constitue pas une garantie absolue de non-régression ni une recette authentifiée de production.
- À la fin de cette première passe, les trois nouvelles migrations étaient appliquées **localement seulement** et le code n’avait pas encore été poussé. Voir l’état distant actualisé ci-dessous.
- Procédure et prérequis : `docs/operations/MISE_EN_SERVICE.md`.

## Reprise après le push `ac0b0980` — 9 septembre

- Le dépôt local était propre à la reprise. `git ls-remote` confirme `ac0b09805af7b9d578013384a61709f3450c36f8` sur `main` distant.
- [Vercel signale un déploiement réussi](https://vercel.com/samuelmuhadri-2777s-projects/athleteoss/4tFsYazkVxzF7yfhF7x7NoV5uWCH). Le bundle servi par l’URL de production contient les nouveaux parcours de ré-authentification et les notices pilote, ainsi que le projet Supabase attendu. Les sondes publiques repassent **9/9**.
- Le push Git **n’a pas déployé Supabase** : les migrations `20260908020000`, `20260908030000`, `20260908040000` sont toujours absentes du distant. `signup` reste en version 12 et `admin-actions` en version 7, datées du 8 septembre. Ne pas présenter les nouvelles protections serveur ou les affectations comme actives en production.
- [La CI de ce commit](https://github.com/samuelmuhadri-art/athleteos/actions/runs/34319033854) a passé 149 parcours navigateur sur 150. L’unique échec est une ambiguïté du test de messagerie 390 px : le sélecteur global correspond à la bulle et au champ de saisie, puis aux messages d’essais précédents.
- Correctif du test : texte unique par tentative, attente de la remise à zéro du champ, recherche dans la conversation, unicité de la bulle et contrôle de persistance après rechargement. Aucun sélecteur `.first()` ajouté pour masquer les doublons, aucune assertion supprimée.
- Recette locale réelle : `post-refonte.spec.js --repeat-each=3 --workers=2 --retries=1` → **33/33 réussis**, sans retry, en 59,1 secondes. Authentification et base Supabase locales réelles, contrairement aux parcours simulés de la première passe. Build et lint ciblé réussis. Les quatre clubs, sept comptes et données de cette recette ont été supprimés après vérification de leurs identifiants.
- L’inventaire distant des sauvegardes reste `backups=[]`, PITR désactivé. Choix de l’emplacement de sauvegarde demandé avant toute migration de production. SMTP/domaine, validation des coordonnées légales et service de monitoring restent à finaliser.
- Le résultat de la CI distante après publication du correctif doit être vérifié séparément ; la réussite locale ne remplace pas cette vérification.
