# Audit intégral AthleteOS — rapport consolidé

Date : 1er août 2026  
Branche : `audit/athleteos-complete`  
Base : `69019f8 feat: improve PWA install and app consistency`

## Résumé exécutif

### État initial

AthleteOS était déjà une application React/Supabase riche : espaces coach et athlète, charge d’entraînement, planning, performances, compétitions, rapports, messagerie, PWA et notifications. La baseline frontend était reproductible après libération d’un verrou Windows : lint sans erreur, typecheck, 320 tests, couverture métier ciblée et build.

Les risques majeurs trouvés concernaient les dépendances, l’identité des souscriptions Push sur appareil partagé, les opérations administratives/invitations non atomiques, la semaine ISO sans année, l’idempotence des notifications, l’autorisation et les quotas de `send-push`, les erreurs silencieuses, l’accessibilité des fenêtres, le thème public et la cohérence PWA.

### Corrections principales

- Dépendances transitives corrigées; audit npm final à zéro vulnérabilité connue.
- Souscription Push liée au compte courant et révoquée avant déconnexion.
- Suppression membre et deux parcours d’invitation déplacés vers des RPC transactionnelles/verrouillées.
- Année ISO propagée dans les calculs, vues, rapports, dashboards et Edge Functions.
- Rapports et rappels rendus idempotents; dimanche inclus et séances annulées exclues.
- `send-push` borné par méthode, authentification, club, corps, destinataires et quotas persistants.
- Erreurs Edge/Storage/Supabase auparavant silencieuses rendues observables.
- Comportement clavier partagé appliqué aux principales fenêtres coach et athlète.
- Thème initialisé dès la racine, zoom mobile rétabli, PWA et headers durcis.
- Tests de concurrence contractuels, année ISO, échelle 200 athlètes, PWA et responsive ajoutés.
- Documentation, CI, guides et registres d’audit mis à jour.

Aucune fonctionnalité, page, migration ou donnée n’a été supprimée par l’audit. Le fichier généré `dist/sw.js` a été restauré exactement à son état suivi après le build. Le déplacement Repomix préexistant appartient à l’utilisateur et reste intact.

### État final vérifié

- lint : code 0, aucune erreur, 23 avertissements Fast Refresh connus;
- typecheck : code 0;
- tests : 55 fichiers, 357/357;
- couverture métier ciblée : 96,59 % statements, 92,25 % branches, 100 % fonctions, 99,22 % lignes;
- build : code 0, 2 803 modules, PWA générée;
- audit npm : zéro vulnérabilité connue;
- smoke/PWA publics : 10/10;
- visuel public : 18/18, clair/sombre, 320 à 1440 px, zoom 200 %;
- inventaire : 306 fichiers suivis ou non ignorés classés à la clôture, livrables d’audit inclus.

### Limite structurante

Docker Desktop ne fonctionne pas sur cette machine. Le service est arrêté, son démarrage a été refusé et le moteur expire. Internet fonctionne. Les 44 migrations, le reset local, la génération réelle des types, RLS x2, les intégrations et les E2E authentifiés ne sont donc **pas** déclarés réussis. Les cinq nouvelles migrations ont des preuves statiques, pas une preuve d’exécution Postgres.

### Maturité

Verdict : **MVP utilisable sous surveillance**. Une bêta privée est raisonnable uniquement sur un staging isolé après passage des gates Supabase/RLS/intégration/E2E. L’ouverture à de vrais clubs ou la production n’est pas recommandée avant ces validations et les décisions RGPD/scientifiques.

## Architecture

| Couche | Architecture observée | Preuve / état |
|---|---|---|
| Frontend | React 19, Vite 8, chargement dynamique des modules coach/athlète | lint, typecheck, tests et build verts |
| Auth/état | Supabase Auth, contextes React, profil `users` via `auth_uid` | tests unitaires; E2E auth bloqués |
| Backend | Supabase Postgres, Auth, Storage, RPC, Realtime | cartographié; runtime local bloqué |
| Données | 44 migrations, vues de charge, modèles versionnés, contraintes/index | contrats statiques; reset non exécuté |
| Edge | `signup`, `admin-actions`, `send-push`, `session-reminders`, `weekly-cron` | lint/type et contrats statiques |
| RLS | policies club/ownership, grants et tests de régression existants | deux passages requis mais non exécutés |
| Storage | branding public contrôlé et documents/PDF privés par club | analyse statique; intégration bloquée |
| PWA | injectManifest, manifeste, SW custom, offline et Push | build + 2/2 PWA Chromium |
| CI | GitHub Actions lint/type/tests/build/RLS/E2E | workflow ajusté et analysé; non déclenché ici |
| Déploiement | Vercel SPA + headers, Supabase séparé | aucun déploiement effectué |

## Analyse par module

| Module | Objectif, architecture et données | Problèmes / corrections | Tests et état final | Risque restant |
|---|---|---|---|---|
| Authentification | session Supabase, profil et routage par rôle | Push révoqué avant signOut; erreurs mieux bornées | tests Push, lint/type/build | E2E multi-rôles bloqués |
| Inscription | création coach/athlète et invitations | création + consommation individuelle atomiques | contrat SQL statique | exécution concurrente réelle |
| Administration | invitations, rôles, suppression et audit log | suppression transactionnelle; acceptation membre existant idempotente; collisions vérifiées | contrats admin/invitation | migrations non exécutées |
| Dashboard coach | séances, états, alertes et charge | année ISO propagée; feed consolidé | tests métier et échelle | données réelles/staging |
| Athlètes coach | liste, fiches, blessures, records, import | fenêtres rendues cohérentes au clavier | tests dialog + build | lecteur d’écran réel |
| Planning coach | séances, affectations, PDF et suppression | erreurs de suppression propagées; dialogs accessibles | tests existants + build | cycle complet non transactionnel |
| Charge | charge globale et six axes | semaine+année ISO; cohérence des agrégations pures | couverture ciblée élevée | SQL à comparer au JS |
| Rapports | groupes hebdomadaires et synthèses | clés année ISO, semaine 1 corrigée, libellés avec année | weeklyReports/helpers | vue SQL runtime |
| Performances/records | normalisation, contexte et historique | contrats existants conservés; dialogs accessibles | suite globale | E2E et DB réelle |
| Compétitions | événements et résultats transactionnels | modales accessibles; logique conservée | tests existants | RPC runtime et concurrence |
| Messagerie/club | messages, posts, commentaires | panneaux accessibles; autorisations conservées | lint/type/build | RLS inter-clubs |
| App athlète | dashboard, planning, forme, blessure, objectifs, perfs | fenêtres et année ISO corrigées | tests composants/domaines | parcours authentifiés |
| Notifications | alertes, rappels, récapitulatifs, Push | dedupe_key, upserts, dimanche, annulations, logs nettoyés | edgeCronHardening | planificateur et fournisseur réel |
| PWA | installation, offline, mises à jour | manifeste unifié, cache robuste, URL même origine | PWA 2/2, smoke 8/8 | appareils réels |
| UI/accessibilité | responsive, thèmes, dialogs, navigation mobile | hook de dialog partagé, zoom, thème racine | 18/18 visuels et tests focus | pages auth + screen reader |

## Bugs et problèmes

Le registre exhaustif avec reproduction, attendu/observé, cause, fichiers, migration et risque restant est `AUDIT_ATHLETEOS_ISSUES.json`.

| ID | Gravité | Module | Problème | Correction | Test / statut |
|---|---|---|---|---|---|
| AOS-DEP-001 | P1 | dépendances | deux avis élevés | lockfile mis à jour | audit npm vert |
| AOS-PUSH-001 | P1 | auth/Push | endpoint lié à l’ancien compte | réassociation + révocation | testé |
| AOS-DATA-001 | P1 | admin | suppression partielle possible | RPC transactionnelle | statique seulement |
| AOS-INV-001 | P1 | signup | consommation non atomique | RPC atomique | statique seulement |
| AOS-INV-002 | P1 | admin | double acceptation concurrente | RPC verrouillée/idempotente | statique seulement |
| AOS-LOAD-001 | P2 | charge | semaine sans année ISO | contrat année+semaine | JS testé, SQL statique |
| AOS-CRON-001 | P2 | crons | dimanche/annulations/doublons | bornes, filtres, dedupe | statique seulement |
| AOS-PUSH-002 | P2 | send-push | spam interne possible | quotas persistants | mitigé, architecture ouverte |
| AOS-A11Y-001 | P3 | dialogs | focus et Échap incohérents | primitive partagée | testé |
| AOS-THEME-001 | P3 | auth public | thème enregistré ignoré | hook à la racine | 18/18 visuels |
| AOS-PWA-001 | P3 | PWA | sources/cache/navigation fragiles | unification/durcissement | 10/10 smoke/PWA |
| AOS-PERF-001 | P3 | agrégation | échelle non prouvée | scénario 200 x 7 | 27 ms observés |
| AOS-TEST-001 | P3 | Vitest | fork Windows instable | pool threads, 2 workers | 357/357 |
| AOS-DATA-002 | P2 | séances | mutations multi-étapes | erreurs propagées | risque ouvert |
| AOS-ENV-001 | P1 | validation | Docker indisponible | blocage documenté | ouvert |
| AOS-GIT-001 | P4 | Repomix | déplacement utilisateur | préservé | user-owned |

## Fichiers modifiés

La ligne de chaque fichier, sa catégorie, son but, son statut, ses tests et son risque figurent dans `AUDIT_ATHLETEOS_FILE_COVERAGE.csv`. Les groupes ci-dessous expliquent les changements matériels sans masquer de fichier important.

| Groupe de fichiers | Raison / changements | Risque | Preuves |
|---|---|---|---|
| `.github/workflows/ci.yml`, README, guides et statut | aligner commandes, gates et documentation | workflow distant non lancé | analyse statique + commandes locales |
| `package-lock.json` | corriger dépendances transitives | futurs avis | npm audit 0 |
| `index.html`, manifeste, SW, Vite, Vercel, bannière | cohérence PWA, zoom et headers | appareils réels | build + PWA/smoke |
| `App.jsx`, `AuthContext.jsx`, hooks thème/Push | thème public et identité Push | auth réelle | tests unitaires + visuels |
| `useAccessibleDialog.js`, `Modal.jsx` et modales coach | focus, Échap, scroll, restitution | lecteur d’écran | tests dialog + build |
| composants/modales athlète et `MobileMoreSheet` | même comportement dialog | appareils réels | lint/type/tests |
| helpers, trainingLoad, weeklyReports, coachFeed | année ISO et cohérence de charge | divergence SQL | tests métier/ISO |
| dashboards, ChargeView, Rapports | consommer année ISO et libellés non ambigus | données anciennes | suite globale |
| cinq Edge Functions + `_shared/isoWeek.ts` | validation, erreurs, idempotence, quotas et dates | runtime Supabase | contrats statiques |
| cinq nouvelles migrations | transactions, ISO, dedupe, quotas | exécution non prouvée | tests de migration statiques |
| `database.types.ts` | refléter les nouveaux champs utilisés | génération DB bloquée | typecheck; comparaison à faire |
| tests domaine/composants/E2E | prouver les corrections et l’échelle | portée ciblée | 357/357 + 28 Playwright |
| `docs/audit/screenshots/` | 18 preuves visuelles finales | pages publiques seulement | audit-visual 18/18 |

`athleteos/repomix-output.xml` supprimé dans le statut et `repomix-output.xml` non suivi n’ont pas été créés, modifiés ou préparés par cet audit.

## Base de données

### Migrations et intégrité

Le dépôt contient 44 migrations ordonnées. Les cinq ajouts sont listés dans la checklist de déploiement. Ils apportent :

- une suppression membre transactionnelle et verrouillée;
- une création par invitation individuelle atomique;
- `iso_year`, `dedupe_key` et index d’unicité pour les vues/notifications;
- une acceptation de membre existant atomique et idempotente;
- un journal persistant de tentatives Push et ses index de quota.

### RPC, contraintes, index et concurrence

Les RPC administratives utilisent `security definer`, un `search_path` borné et des grants limités au service role. Les transitions critiques verrouillent les lignes concernées. Les clés de déduplication transforment les insertions de rappels/rapports en upserts idempotents. Les quotas Push comptent les fenêtres minute/jour dans Postgres.

### RLS, grants et Storage

Les policies et tests RLS existants ont été cartographiés. Les nouvelles tables/RPC retirent les droits directs `anon` et `authenticated`. Toutefois, sans reset ni test RLS réel, ces protections restent une preuve statique. L’isolation Storage/PDF et les compensations de fichiers doivent être testées avec deux clubs.

### Risque restant

`CreateSessionModal` et certains parcours Planning enchaînent encore séance, affectations et éventuellement Storage côté client. Les erreurs sont maintenant visibles, mais une panne intermédiaire peut laisser un état partiel. Une RPC métier/stratégie de compensation reste à décider.

## Sécurité

### Failles ou faiblesses corrigées

- vulnérabilités transitives connues;
- fuite fonctionnelle de souscription Push entre comptes d’un appareil;
- mutations administratives/invitations non atomiques;
- destinataires inter-clubs et entrées insuffisamment bornés dans les Edge Functions;
- absence de quotas persistants sur `send-push`;
- navigation de notification vers une origine arbitraire;
- détails d’erreurs/logs trop bavards;
- headers HTTP défensifs incomplets.

### Protections vérifiées

Les vérifications unitaires/statiques couvrent méthode, token, body, erreurs, club commun, RPC service role, quotas et idempotence. Le build vérifie l’intégration frontend. Aucun secret réel n’est suivi et aucun appel de production n’a été effectué.

### Risques restants

- RLS et grants non exécutés au runtime;
- endpoint `send-push` encore générique : un outbox d’événements allowlistés serait plus robuste;
- RGPD, conservation, export/suppression et information utilisateur nécessitent validation juridique;
- CSP et Sentry doivent être vérifiés sur une preview réelle.

## Tests

Les commandes, durées et limites sont détaillées dans `AUDIT_ATHLETEOS_TEST_EVIDENCE.md`.

| Domaine | Résultat |
|---|---|
| lint | 0 erreur, 23 warnings |
| typecheck | réussi |
| unitaires/composants/contrats | 357/357 |
| couverture métier ciblée | 96,59 / 92,25 / 100 / 99,22 % |
| build | réussi |
| audit dépendances | 0 vulnérabilité connue |
| Chromium public visuel | 18/18 |
| Chromium smoke/PWA | 10/10 |
| Supabase reset/migrations | bloqué |
| RLS x2/intégration | bloqué |
| E2E authentifiés | bloqué |
| autres navigateurs/appareils | non exécuté |

## Performance

### Avant

La baseline produisait déjà un bundle découpé dynamiquement. Aucun test à 200 athlètes ne prouvait l’agrégation pure et la semaine ISO pouvait fusionner inutilement des périodes historiques.

### Après

- entrée 312,54 kB / 96,12 kB gzip;
- graphique principal 247,92 kB / 78,16 kB gzip;
- CSS 115,61 kB / 21,62 kB gzip;
- 67 ressources précachées, 1 752,95 KiB;
- 200 athlètes x 7 séances agrégés en 27 ms dans le test observé;
- clé année+semaine évitant les collisions historiques.

### Limites

Le bundle Recharts reste important. La performance authentifiée, les N+1, la pagination de longues listes, la latence Supabase, la mémoire et les abonnements Realtime doivent être mesurés sur des données/staging réels.

## UX/UI et accessibilité

### Vérifié

- écran public clair/sombre aux largeurs 320, 360, 375, 390, 768, 1024, 1280 et 1440 px;
- zoom 200 %;
- invitation 320 px;
- absence de débordement horizontal dans les scénarios;
- thème enregistré dès l’écran public;
- rôle/label des dialogs, focus initial, piège de focus, Échap, scroll body et restitution du focus;
- navigation mobile « Plus » avec comportement de panneau cohérent;
- zoom utilisateur non interdit.

Les captures finales sont dans `athleteos/docs/audit/screenshots/`. Elles sont « après » uniquement; aucune preuve « avant » n’existait. Les pages connectées, accents personnalisés, états vides/erreur/chargement, longues listes et appareils réels restent à capturer après mise à disposition de Supabase.

## Documentation

Les README racine/application, `GUIDE_IA.md`, `status.md`, la CI et les fichiers PWA ont été alignés avec les commandes et l’architecture observées. Les six livrables obligatoires sont présents. Le README des captures explique leur portée et empêche de les présenter comme une comparaison avant/après.

La checklist finale donne les commandes exactes à exécuter sur une machine avec Docker ou sur un staging isolé.

## Dette technique

| Dette | Impact | Priorité | Complexité | Pourquoi non traitée entièrement |
|---|---|---:|---:|---|
| cycle séance/affectations/Storage non atomique | état partiel | P2 | élevée | nécessite RPC et tests DB/Storage |
| `send-push` générique | abus interne malgré quotas | P2 | moyenne/élevée | décision produit sur événements autorisés |
| runtime SQL/RLS non prouvé | risque d’autorisation/migration | P1 | moyenne | Docker indisponible |
| E2E authentifiés absents | parcours critiques non prouvés | P1 | moyenne | fixtures Supabase indisponibles |
| couverture globale limitée | régressions UI/Edge possibles | P3 | moyenne | couverture actuelle volontairement métier ciblée |
| warnings Fast Refresh | dette de structure des exports | P4 | faible/moyenne | aucun impact runtime observé |
| chunk Recharts volumineux | premier chargement analytique | P3 | moyenne | optimisation à mesurer sur staging |
| appareils/lecteurs d’écran réels | accessibilité/installation incomplètes | P2 | moyenne | matériel et sessions réelles requis |
| validation RGPD/scientifique | risque légal et de confiance | P1 | externe | expert juridique/scientifique requis |

## Verdict chiffré

Les notes évaluent le dépôt vérifié localement, avec pénalité explicite pour l’absence de runtime Supabase.

| Axe | Note /10 | Motif principal |
|---|---:|---|
| Stabilité | 7,5 | frontend vert, backend non exécuté |
| Sécurité | 7,0 | corrections fortes, RLS runtime manquant |
| Qualité du code | 8,0 | domaines structurés, 23 warnings mineurs |
| Fiabilité des données | 6,5 | transactions ajoutées, reset absent |
| UX/UI | 8,0 | rendu public cohérent; auth à revoir |
| Accessibilité | 7,0 | dialogs/zoom corrigés; screen reader restant |
| Performance | 7,5 | bundle raisonnable et test 200; staging manquant |
| Testabilité | 8,0 | 357 tests et contrats; E2E auth absent |
| Maintenabilité | 7,5 | helpers partagés et docs; dette séance |
| Maturité produit | 6,5 | MVP solide, validations externes manquantes |
| Capacité de déploiement | 5,5 | build prêt, gates Supabase/staging ouverts |
| Commercialisation | 4,5 | RGPD, scientifique et données réelles non validés |

Verdict final : **MVP utilisable sous surveillance**. Le frontend public et les contrats métier ciblés ont beaucoup progressé. La prochaine étape n’est pas d’ajouter des fonctions au hasard : c’est d’exécuter la checklist Supabase/RLS/E2E sur un environnement de test fonctionnel, puis de traiter les risques ouverts avant une bêta avec de vrais clubs.
