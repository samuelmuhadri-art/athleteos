# Mise en service AthleteOS

## État observé le 8 septembre 2026

La sonde publique `node scripts/production-smoke.mjs` a passé 9/9 contrôles sur le frontend et les refus anonymes de Supabase, avec nouvelle vérification le 9 septembre. Elle ne crée rien, n’envoie rien et ne lance pas les crons. Elle ne remplace pas la recette connectée.

`supabase backups list --project-ref kuqafsmkwajeipzolbky` : région `eu-west-1`, `pitr_enabled=false`, `backups=[]`. Aucune sauvegarde restaurable n’est exposée par cette commande à cette date. Le dump de schéma réalisé précédemment ne couvre pas les données.

## Emails : activation sans interrompre le pilote

1. Choisir un fournisseur SMTP et un domaine d’envoi que l’exploitant contrôle. Aucun fournisseur n’est actuellement fourni par le propriétaire ; ne pas utiliser une adresse Gmail comme domaine vérifié d’un prestataire tiers.
2. Configurer chez le fournisseur les enregistrements de domaine requis, puis le SMTP dans Supabase Auth. Les identifiants SMTP restent dans le service, jamais dans `VITE_*`, Git ou une conversation.
3. Configurer l’URL du site et les redirections autorisées : domaine de production exact et URL de recette. Ne pas ajouter de wildcard couvrant des sites tiers. Tester connexion et reset sur mobile et ordinateur.
4. Activer **Confirm email**, **Secure email change** (double confirmation) et **Secure password change** dans Auth. Le flux de ré-authentification par mot de passe rend la session récente avant la modification depuis Réglages. La protection native Auth reste indispensable contre les appels directs à son API.
5. Appliquer les migrations, livrer le client de confirmation puis le serveur signup. Seulement après un vrai test de livraison, définir le secret Edge `SIGNUP_REQUIRE_EMAIL_CONFIRMATION=true` et `APP_URL` sur l’URL exacte de production. Aucun secret SMTP n’est lu par le frontend.
6. Essayer création du club, invitation athlète et coach, renvoi, lien expiré/utilisé, ouverture sur un autre appareil, oubli du mot de passe et changement d’adresse. Vérifier que les adresses non confirmées ne peuvent pas se connecter.

Sans ce prérequis externe, le serveur conserve le pilote historique : inscription immédiatement confirmée. Ne pas annoncer la confirmation réelle comme active. Une erreur SMTP après la création métier laisse le compte en attente : le renvoi est possible, sans supprimer Auth ni recréer le club.

Sources : [SMTP Supabase](https://supabase.com/docs/guides/auth/auth-smtp), [sécurité des mots de passe](https://supabase.com/docs/guides/auth/password-security).

## Sauvegarde et restauration

Décisions requises : destination de sauvegarde chiffrée hors du dépôt, personne responsable, fréquence, durée de conservation et budget éventuel. Aucune souscription payante n’est engagée automatiquement.

Une sauvegarde exploitable comprend la base, les fichiers privés Storage et un inventaire de configuration. Ne pas placer les exports personnels, dumps ou secrets dans Git, dans un artefact GitHub public ou dans ce dossier OneDrive de développement.

Pour la base : suivre la procédure officielle de sauvegarde logique (rôles, schéma, données avec COPY, historique des migrations). Conserver également les migrations qui modifient `auth` et `storage`, dont le trigger de synchronisation des emails. Les secrets serveur nécessitent un stockage séparé et protégé ; un inventaire de leurs noms ne constitue pas une sauvegarde de leurs valeurs.

Les sauvegardes de base ne contiennent pas les octets des fichiers Storage. Sauvegarder séparément les buckets, objets et fichiers ; établir un manifeste avec chemins, tailles et SHA-256, puis comparer un téléchargement restauré. Inclure les PDF de séances, documents et images privées du club.

Restauration : créer une destination **distincte** de `kuqafsmkwajeipzolbky`, sans SMTP de production ni envoi Push/cron actif. Restaurer la base, les fichiers et la configuration selon la procédure du fournisseur. Comparer les volumes par table, les fichiers et leur empreinte, puis tester connexion, isolement des clubs et lecture des documents avec trois rôles. Rejouer les suppressions de données intervenues après la date de sauvegarde avant toute remise en service. Ne jamais restaurer une sauvegarde ancienne sur la production pour un exercice.

Le script `node scripts/local-restore-drill.mjs` teste une restauration SQL isolée dans Docker local. Il nettoie uniquement la base et l’archive temporaires qu’il crée. Le lancement doit être séparé des tests qui modifient les données ; il compare les comptes de lignes. Il **ne prouve pas** la restauration des fichiers Storage, des secrets, ni du projet de production.

Sources : [sauvegardes Supabase](https://supabase.com/docs/guides/platform/backups), [restauration CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [fichiers Storage](https://supabase.com/docs/guides/storage/management/download-objects).

## Surveillance et réponse aux incidents

- La sonde GitHub prévue toutes les six heures ne devient active qu’après push du workflow sur la branche par défaut. Activer les notifications d’échec pour le responsable et déclencher une exécution manuelle de vérification.
- Sentry nécessite un projet et `VITE_SENTRY_DSN` dans Vercel, puis un rebuild. Le code exclut les données métier, jetons, breadcrumbs et traces de navigation des événements envoyés. Aucun replay n’est activé. Vérifier le contrat, la conservation et le destinataire des alertes avant activation.
- Vérifier les erreurs de signup/SMTP, admin-actions, RPC, outbox et crons dans Supabase. Relever seulement l’heure, le type d’erreur et l’identifiant de corrélation ; ne pas copier de dossier sportif dans un ticket.
- En cas d’incident : qualifier le périmètre, stopper uniquement les envois ou actions affectés, conserver les traces nécessaires, corriger puis tester sur recette. Évaluer avec le responsable les obligations d’information applicables en cas de violation de données.

## Juridique : éléments non délégables au code

Les pages du pilote sont accessibles à `/?legal=privacy`, `/?legal=terms` et `/?legal=legal`, sans connexion, et depuis les réglages. Elles distinguent les comportements actuels des points non validés. Elles ne constituent pas une politique commerciale finale.

Avant publication finale : confirmer l’identité et les coordonnées publiques de l’exploitant, son statut et les identifiants d’entreprise applicables ; déterminer les responsabilités exploitant/club, les bases légales et les conditions propres aux données de santé, le parcours mineurs, les durées réelles de conservation, les sous-traitants et éventuels transferts. Ne pas assimiler l’activation du wellness à un consentement explicite.

Sources : [information des personnes — APD](https://www.autoriteprotectiondonnees.be/professionnel/rgpd-/droits-des-citoyens/droit-a-l-information), [consentement — APD](https://www.autoriteprotectiondonnees.be/professionnel/rgpd-/bases-juridiques/consentement), [mentions obligatoires — SPF Économie](https://economie.fgov.be/fr/e-commerce/mettre-en-place-vos-supports/les-informations-obligatoires).
