# Preuves de test AthleteOS

Date finale : 1er août 2026  
Branche : `audit/athleteos-complete`  
Base : `69019f8 feat: improve PWA install and app consistency`

## Lecture des statuts

- **Vérifié** : commande réellement exécutée dans ce dépôt avec son code de sortie.
- **Statique** : contrat de code ou SQL vérifié sans démarrer Supabase.
- **Bloqué** : dépend du moteur Docker local, indisponible sur cette machine.
- Aucun test ni aucune mutation n’a ciblé une base Supabase, Vercel ou un service Push de production.

## Environnement et baseline

La baseline détaillée, prise avant les corrections, est conservée dans `AUDIT_ATHLETEOS_BASELINE.md`. Elle consignait Node `v24.15.0`, npm `11.12.1`, l’installation, le lint, le typecheck, 320 tests, la couverture ciblée et le build.

Le premier `npm ci` avait échoué avec `EPERM` sur un binaire Rolldown verrouillé par des serveurs Vite locaux. Après arrêt ciblé de ces processus, `npm ci` a réussi avec 639 paquets. Le réseau Internet a ensuite été confirmé par `npm audit`; Docker est un blocage indépendant.

## Validation finale vérifiée

| Commande | Code | Durée observée | Résultat |
|---|---:|---:|---|
| `npm ci` (relance finale autorisée) | 0 | 71,0 s | 639 paquets réinstallés, 640 audités |
| `npm run lint` après installation propre | 0 | 16,4 s | 0 erreur, 23 avertissements Fast Refresh |
| `npm run typecheck` après installation propre | 0 | 5,2 s | `tsc --noEmit` réussi |
| `npm test` après installation propre | 0 | 213,2 s | 55 fichiers, 357/357 tests; exécuté en parallèle du build |
| `npm run test:coverage` | 0 | 68,2 s | 55 fichiers, 357/357 tests |
| `npm run build` après installation propre | 0 | 22,5 s | 2 803 modules, build PWA généré; exécuté en parallèle des tests |
| `npm audit --audit-level=high` | 0 | 2,7 s | 0 vulnérabilité connue |
| `npm exec playwright test e2e/audit-visual.spec.js -- --workers=1` | 0 | 22,9 s | 18/18 scénarios Chromium |
| `npm exec playwright test e2e/smoke.spec.js e2e/pwa.spec.js -- --workers=1` | 0 | 14,0 s | 10/10 scénarios Chromium |

Le premier audit npm final lancé dans le bac à sable a échoué sur l’accès au endpoint npm et au dossier de logs. Il a été relancé avec l’accès réseau autorisé et a terminé avec le code 0. De même, le premier `npm ci` final a échoué après 102,9 s sur `EACCES` réseau et un nettoyage `@sentry` verrouillé; la relance autorisée a réussi en 71 s. Ces tentatives échouées ne sont pas présentées comme des preuves vertes.

## Couverture V8

| Mesure | Valeur finale |
|---|---:|
| Statements | 96,59 % (454/470) |
| Branches | 92,25 % (381/413) |
| Functions | 100 % (116/116) |
| Lines | 99,22 % (383/386) |

Limite importante : `vitest.config.js` inclut seulement `src/domain/disciplines.js`, `src/utils/loadAxes.js` et `src/utils/trainingLoad.js`. Ces pourcentages sont une couverture métier **ciblée**, pas la couverture globale de toutes les pages React ou Edge Functions. Aucun seuil n’a été abaissé.

## Build et performance

- Entrée JS : 312,54 kB brut / 96,12 kB gzip.
- Chunk graphique principal : 247,92 kB / 78,16 kB gzip.
- Helpers partagés : 216,16 kB / 56,94 kB gzip.
- CSS : 115,61 kB / 21,62 kB gzip.
- Précache PWA : 67 entrées / 1 752,95 KiB.
- Avertissement de build restant : `inlineDynamicImports` est déprécié dans la chaîne PWA.
- Test synthétique : agrégation de 200 athlètes sur 7 séances en 27 ms lors de l’exécution observée; 200 signaux d’absence produits comme attendu.

Le test synthétique mesure les fonctions pures, pas la latence Supabase, le rendu DOM ni la mémoire d’un navigateur authentifié.

## Tests ajoutés ou renforcés

| Fichier | Contrat couvert |
|---|---|
| `src/utils/pushSubscriptions.test.js` | réassociation et révocation Push |
| `src/components/ui/Modal.test.jsx` | rôle dialog, Échap, focus et sauvegarde |
| `src/hooks/useAccessibleDialog.test.jsx` | piège et restitution du focus, fermeture désactivable |
| `src/domain/adminActionsHardening.test.js` | méthode, auth, erreurs et actions admin |
| `src/domain/transactionalUserRemovalMigration.test.js` | transaction et permissions de suppression membre |
| `src/domain/atomicInvitationSignupMigration.test.js` | création et consommation atomiques |
| `src/domain/invitationLifecycleContract.test.js` | acceptation concurrente d’un membre existant |
| `src/domain/isoWeekContract.test.js` | année ISO, semaine 1 et contrat JS/SQL/Edge |
| `src/domain/edgeCronHardening.test.js` | crons, idempotence, erreurs et quotas Push |
| `src/domain/performanceScale.test.js` | échelle 200 athlètes x 7 séances |
| `e2e/audit-visual.spec.js` | thèmes, largeurs, zoom et captures |
| `e2e/pwa.spec.js` | manifeste, Service Worker et rechargement offline |
| `e2e/smoke.spec.js` | démarrage public, invitation et zoom mobile |

## Preuves responsive et visuelles

Le test `audit-visual.spec.js` a vérifié l’écran d’authentification en clair et sombre aux largeurs 320, 360, 375, 390, 768, 1024, 1280 et 1440 px, ainsi que le zoom 200 % et l’invitation à 320 px. Les 18 captures finales sont dans `athleteos/docs/audit/screenshots/`.

Les fichiers sont uniquement des captures **après correction**. Aucune capture avant fiable n’avait été enregistrée au début; aucune fausse comparaison avant/après n’est produite. Les pages coach et athlète authentifiées n’ont pas été capturées faute de fixtures Supabase exécutables.

## PWA Chromium

Les deux tests permanents PWA ont vérifié :

1. manifeste récupérable et cohérent (`display=standalone`, orientation portrait);
2. Service Worker installé et contrôlant la page;
3. passage hors ligne;
4. rechargement du shell public depuis le cache.

Résultat : 2/2. Les huit smoke complémentaires sont également verts. Cela ne prouve pas l’installation native sur un appareil iOS ou Android réel.

## Supabase, RLS et authentification — bloqués

| Contrôle demandé | État réel | Commande à exécuter ailleurs |
|---|---|---|
| Docker engine | Bloqué | réparer/démarrer Docker Desktop |
| Supabase depuis zéro | Non exécuté | `supabase start` |
| reset et 44 migrations | Non exécuté | `supabase db reset` |
| types DB générés/synchronisés | Non exécuté | générer après reset puis comparer |
| RLS passage 1 | Non exécuté | `npm run test:rls` |
| RLS passage 2 | Non exécuté | refaire reset puis `npm run test:rls` |
| intégrations | Non exécuté | `npm run test:integration` |
| E2E authentifiés coach/athlète | Non exécuté | configurer fixtures puis `E2E_WITH_AUTH=1 npm run test:e2e` |
| concurrence invitations/suppressions | Statique seulement | rejouer en parallèle sur DB de test |
| PDF privés et Storage | Non exécuté | tester isolation et compensation sur DB de test |
| Push réel | Non exécuté | utiliser des comptes et endpoints de test dédiés |

Le service Docker local est arrêté, son démarrage a été refusé et `docker version` a expiré. L’utilisateur confirme que Docker ne fonctionne habituellement pas sur son PC. Internet fonctionne; ce n’est donc pas un blocage réseau.

## Contrôles de non-régression

- Aucun secret réel ni fichier `.env` n’a été ajouté au suivi Git.
- Aucun appel de déploiement, `supabase db push` ou envoi Push de masse n’a été lancé.
- Le déplacement Repomix préexistant a été laissé intact et non préparé pour commit.
- Le `dist/sw.js` régénéré pour la preuve de build a été remis exactement au contenu suivi dans `HEAD` : les deux hashes objet valent `f5482229d5646fd96a5f2af8495d739822a0eb18` et `git diff --exit-code` renvoie 0.
