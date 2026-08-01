# Rapport final de validation Docker, Supabase, sécurité et qualité

Date : 2026-08-01  
Branche auditée : `audit/athleteos-complete`  
Commit de départ : `f7ed622468e756e322066aed45269f72a3a9c468`  
Environnement : Supabase CLI local sous Docker Desktop/WSL 2, jamais la production

## Verdict

**Validation locale réussie.** La pile complète a été recréée depuis une base vide avec 48 migrations, le seed final, les Edge Functions locales, 379 tests Vitest, 211 contrôles d'intégration et 37 scénarios Playwright authentifiés. Les corrections trouvées pendant l'audit ont été retestées sur une seconde base fraîche.

Aucune action de production n'a été effectuée : aucun `db push`, aucun reset distant, aucun déploiement d'Edge Function, aucun secret de production et aucun appel de test vers le projet hébergé.

## Résultats finaux

| Domaine | Résultat |
| --- | --- |
| Migrations sur base vide | 48/48 appliquées |
| Tables publiques sous RLS | 30/30 ; 0 sans RLS |
| Policies `public` + `storage` | 48 |
| Intégration locale | 211/211 contrôles |
| Second passage RLS | 40/40 |
| Vitest | 60 fichiers, 379/379 tests |
| Couverture statements | 96,59 % |
| Couverture branches | 92,25 % |
| Couverture fonctions | 100 % |
| Couverture lignes | 99,22 % |
| Playwright | 37/37 scénarios |
| PWA hors ligne | 2/2 scénarios |
| TypeScript | réussi |
| ESLint | 0 erreur ; 23 avertissements Fast Refresh connus |
| Build Vite | réussi, 2 804 modules transformés |
| Audit npm production + complet | 0 vulnérabilité |
| Secrets versionnés | aucun détecté |

## Corrections issues de l'audit

### 1. Le seed annulait l'acceptation des photos et documents

La migration `20260801210000_expand_session_attachments.sql` autorisait 22 MIME, mais `supabase/seed.sql`, exécuté après les migrations, rétablissait `application/pdf` uniquement.

Preuve avant correction : le bucket final ne contenait que `{application/pdf}`.  
Correction : la liste du seed est alignée sur la migration.  
Preuve après reset : bucket privé, limite 30 Mo, 22 MIME. Un upload réel PDF, PNG et DOCX passe ; HTML et fichier de 31 Mo sont refusés.

### 2. Ancienne surcharge interne de compétition publique par défaut

L'ajout du paramètre `p_unit` avait créé une deuxième surcharge de `_apply_competition_result`. L'ancienne surcharge `SECURITY DEFINER` conservait le droit implicite `PUBLIC`, tout en créant une ambiguïté PostgREST.

Correction : suppression de la surcharge obsolète et révocation explicite de la signature active pour `PUBLIC`, `anon` et `authenticated`.  
Preuve finale : une seule surcharge, `anon_execute=false`, `auth_execute=false`, tandis que les RPC publiques contrôlées passent toujours 21/21, concurrence comprise.

### 3. Droits de table excessifs pour les rôles Data API

Les rôles `anon` et `authenticated` possédaient `TRUNCATE`, `TRIGGER` et `REFERENCES` sur les tables publiques. RLS ne couvre pas `TRUNCATE`.

Correction : révocation sur toutes les tables existantes et dans les privilèges par défaut du propriétaire applicatif `postgres`. L'usage des séquences est aussi retiré à `anon`.  
Preuve finale : 0 droit dangereux et 0 usage anonyme de séquence, sans régression des parcours authentifiés.

### 4. Crons locaux susceptibles de viser l'URL hébergée

Les migrations historiques planifiaient deux jobs avec l'URL du projet hébergé, même sur une instance locale sans secret Vault. Une pile Docker laissée ouverte aurait pu tenter des requêtes distantes.

Correction : les jobs hérités sont supprimés puis recréés uniquement si `weekly_cron_service_role_key` existe et n'est pas vide dans Vault.  
Preuve finale locale : `scheduled_remote_crons=0`. Les deux fonctions elles-mêmes répondent 200 en dry-run local et refusent un appel non serveur avec 401.

### 5. Test signup non répétable

Le test saturait volontairement le quota de l'IP locale puis laissait les tentatives en base. Un second run démarrait donc en 429.

Correction : IP IPv6 de documentation unique par exécution et nettoyage ciblé de `signup_attempts`.  
Preuve : deux exécutions consécutives à 13/13 chacune, puis passage dans la chaîne d'intégration finale.

### 6. Le setup E2E ne garantissait pas sa promesse « local uniquement »

Le commentaire interdisait la production, mais aucune validation de l'URL n'était codée avant l'utilisation de `service_role`.

Correction : refus de tout protocole autre que HTTP et de tout hôte autre que `127.0.0.1`, `localhost` ou `::1`.  
Preuve : une URL `https://example.invalid` est refusée avant toute requête ; les 37 E2E locaux passent.

### 7. Service worker versionné obsolète

Le premier test hors ligne a échoué car le `dist/sw.js` suivi par Git référençait d'anciens bundles. La restauration de cet ancien artefact suffisait à casser le précache.

Correction : régénération depuis `public/sw.js` et le build actuel.  
Preuve : manifeste installable, 67 ressources précachées (~1,72 Mio) et rechargement du shell avec Chromium totalement hors connexion.

## Validation fonctionnelle et sécurité

### Authentification et rôles

- Création de club, adhésion, réclamation d'un athlète importé et compensation Auth/DB validées.
- Anti-énumération, honeypot, délai minimal et rate-limit validés.
- Matrice `head_coach` / `coach` / `athlete` validée sur les actions administratives.
- Protection du dernier head coach, transfert de propriété, rotation des invitations et idempotence validés.

### Isolation RLS

- Aucun SELECT, UPDATE, DELETE, RPC ou objet Storage inter-club n'a fui.
- Les accès anonymes aux tables sensibles sont refusés au niveau des permissions.
- Les vues `daily_training_load` et `weekly_charge` sont `security_invoker=true`.
- Toutes les fonctions `SECURITY DEFINER` possèdent un `search_path` fixé.

### Transactions et concurrence

- Création de compétition et participants atomique.
- Ajout de résultat, record et outbox atomique.
- Rejeu idempotent sans doublon.
- Deux résultats concurrents enregistrés ; une seule ligne record, meilleure performance conservée.
- Import d'athlètes tout-ou-rien, limites et validations serveur confirmées.

### Stockage privé

- `session-pdfs` reste privé malgré son identifiant historique.
- Uploads PDF, image et Word autorisés dans le dossier du club uniquement.
- Lecture via URL signée ; URL publique permanente refusée ; expiration testée.
- MIME non autorisé et taille supérieure à 30 Mo refusés côté serveur.
- `club-branding` limité aux images, 5 Mo et écriture/suppression head coach.

### Planning et archives

- La frontière d'archive est calculée en date locale : une séance vieille de 7 jours passe dans Archives ; les 6 derniers jours restent dans la liste active.
- Les séances sans date ne disparaissent pas.
- L'affichage Archives est séparé et compté, ce qui évite l'accumulation visuelle dans la liste active.

### Notifications et Edge Functions

- `signup`, `send-push` et `admin-actions` validées via leurs suites réelles locales.
- `weekly-cron` et `session-reminders` validées en dry-run avec les données seedées.
- VAPID de test généré en mémoire ; aucune clé persistée.
- Aucun envoi vers un fournisseur Push externe n'a été effectué : autorisations, résolution des destinataires et chemin serveur sont couverts, pas une livraison réseau sur un abonnement navigateur réel.

## Interface, responsive, thèmes et accessibilité

- Parcours coach : connexion, Dashboard, Planning, Athlètes, invitation, sidebar et navigation mobile.
- Parcours athlète : connexion, tableau de bord, planning, notifications et cinq destinations mobiles.
- Contrôles visuels automatisés à 320, 360, 375, 390, 768, 1024, 1280 et 1440 px, dans les deux thèmes.
- Aucun débordement horizontal sur les écrans audités.
- Champs et boutons tactiles d'au moins 44 px sur mobile.
- Zoom utilisateur autorisé et interface encore utilisable à 200 %.
- Dialogues, navigation, états pressés/sélectionnés et sidebar testés par leurs rôles/attributs ARIA.
- Inspection humaine des captures sombre/clair en 320/390/1440 px : hiérarchie cohérente, aucun texte tronqué ni collision observée.

## Qualité, dépendances et performance de build

- `npm ls --depth=0` est cohérent.
- `npm audit --omit=dev` et `npm audit` : 0 vulnérabilité.
- Plusieurs mises à jour mineures existent ; aucune mise à jour opportuniste n'a été imposée pendant cet audit stable.
- Plus gros chunks gzip : bundle principal ~96,12 kB, graphiques catégoriels ~78,16 kB, helpers ~56,74 kB.
- Les modules fonctionnels restent découpés en chunks chargés à la demande.

## Incidents d'environnement observés

1. Le premier `supabase start`, interrompu une fois pendant le téléchargement, a laissé un lancement sans réseau Docker. Un état vide a été confirmé puis la relance a réussi.
2. Un premier reset a rencontré une course de réinitialisation entre services Supabase ; PostgreSQL est devenu sain quelques secondes plus tard et la relance a appliqué 48/48 migrations.
3. Un appel concurrent a reçu une fois un 502 pendant la charge cumulée initiale. PostgreSQL n'a signalé ni deadlock ni rollback incohérent. Le test isolé a ensuite passé 21/21 et le passage final complet 211/211.
4. Vector redémarre sous Windows lorsque le daemon Docker n'est pas exposé sur TCP 2375. L'exposition non authentifiée du daemon n'a pas été activée. DB, Auth, API, Storage, Realtime, Edge, Kong, Studio et Mailpit étaient sains ; Vector n'est pas requis par l'application et est exclu dans la CI.

## Dettes non bloquantes

- 23 avertissements `react-refresh/only-export-components` sur des fichiers partagés qui exportent composants et utilitaires. Zéro erreur lint ; une correction propre demanderait de scinder ces modules, pas de masquer la règle.
- `vite-plugin-pwa` émet un avertissement de dépréciation interne `inlineDynamicImports`; le build et le mode hors ligne sont fonctionnels.
- Supabase CLI 2.109.1 signale 2.111.0 disponible et deux images locales légèrement différentes du projet lié. Aucun `supabase link` n'a été lancé pour ne pas élargir le périmètre vers le distant.

## État de sortie

- Tous les conteneurs Supabase locaux sont arrêtés.
- Les données locales jetables sont sauvegardées dans le volume Docker par le CLI ; elles ne sont pas une copie de production.
- Le fichier temporaire d'identifiants E2E a été supprimé.
- Le déplacement Repomix préexistant (`athleteos/repomix-output.xml` vers la racine) n'est pas une modification de cet audit et doit rester hors de ses commits.
- La mission source fournie s'arrête au milieu de la phase 0 ; les validations postérieures ont été dérivées des 30 objectifs finaux explicitement listés dans ce document.
