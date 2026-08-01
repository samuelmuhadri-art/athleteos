# Baseline AthleteOS — 1 août 2026

## Périmètre et règles

- Racine Git : `C:/Users/samue/OneDrive - Haute Ecole Léonard de Vinci/Bureau/athleteos-production`
- Application : `athleteos/`
- Branche de travail créée : `audit/athleteos-complete`
- Commit de départ : `69019f8 feat: improve PWA install and app consistency`
- Modification utilisateur préexistante conservée : déplacement de `athleteos/repomix-output.xml` vers la racine.
- Aucun appel destructif ou déploiement n’a été exécuté contre la production.

## Versions

| Commande | Heure locale | Code | Durée | Résultat |
|---|---:|---:|---:|---|
| `node --version` | 09:46 | 0 | incluse dans 2,7 s | `v24.15.0` |
| `npm --version` | 09:46 | 0 | incluse dans 2,7 s | `11.12.1` |
| `git diff --check` | 09:46 | 0 | incluse dans 2,7 s | aucune erreur d’espace |

## Installation reproductible

Premier `npm ci` : échec après 11,2 s avec `EPERM` sur `rolldown-binding.win32-x64-msvc.node`. La cause observée était un verrou Windows maintenu par plusieurs processus Vite encore ouverts dans ce dépôt. Après arrêt ciblé de ces serveurs locaux, sans modification de fichier ni de donnée, le second essai a réussi.

| Commande | Code | Durée | Résultat |
|---|---:|---:|---|
| `npm ci` (essai initial) | 1 | 11,2 s | binaire Rolldown verrouillé par Vite |
| `npm ci` (après libération du verrou) | 0 | 60,0 s | 639 paquets installés |

Avertissements d’installation : `source-map@0.8.0-beta.0` et `glob@11.1.0` déclarés obsolètes par npm.

## Qualité frontend

| Commande | Code | Durée | Résultat |
|---|---:|---:|---|
| `npm run lint` | 0 | 17,5 s | 0 erreur, 23 avertissements `react-refresh/only-export-components` |
| `npm run typecheck` | 0 | 4,7 s | `tsc --noEmit` réussi |
| `npm run test` | 0 | 63,3 s | 45 fichiers, 320/320 tests réussis |
| `npm run test:coverage` | 0 | 72,4 s | 45 fichiers, 320/320 tests réussis |
| `npm run build` | 0 | 19,1 s | 2 801 modules transformés, PWA injectManifest générée |

### Couverture ciblée V8

| Mesure | Résultat |
|---|---:|
| Statements | 96,52 % (445/461) |
| Branches | 91,60 % (349/381) |
| Functions | 100 % (114/114) |
| Lines | 99,20 % (372/375) |

La couverture est volontairement limitée par `vitest.config.js` à `disciplines.js`, `loadAxes.js` et `trainingLoad.js`. Elle ne représente donc pas 96,52 % de l’application entière.

### Build de production

- JavaScript d’entrée : 311,29 kB brut / 95,69 kB gzip.
- Plus gros chunk différé : `CategoricalChart`, 247,92 kB brut / 78,17 kB gzip.
- Utilitaires partagés : 215,43 kB brut / 56,68 kB gzip.
- CSS : 115,61 kB brut / 21,62 kB gzip.
- Précache PWA : 67 entrées, 1 746,30 KiB.
- Avertissement : option `inlineDynamicImports` dépréciée dans la chaîne PWA.

## Dépendances et sécurité

Le premier `npm audit` exécuté dans le bac à sable n’a pas pu joindre le registre. Le contrôle autorisé avec accès réseau a ensuite produit un résultat exploitable :

| Commande | Code | Résultat |
|---|---:|---|
| `npm audit --audit-level=low` | 1 | 2 vulnérabilités transitives de gravité élevée |

- `brace-expansion` : risque de déni de service par expansion non bornée (`GHSA-mh99-v99m-4gvg`).
- `fast-uri` : confusion d’hôte avec séparateur d’autorité antislash (`GHSA-v2hh-gcrm-f6hx`).
- npm indique qu’une correction compatible est disponible via mise à jour du lockfile ; elle sera inspectée avant application.

## État documentaire initial

- `GUIDE_IA.md` affirme à tort qu’il n’existe ni `tsconfig.json` ni typecheck et cite l’ancien workflow `rls-check.yml`.
- `status.md` se termine par une contradiction : tâche active « aucune », puis « arrêt après la tâche 14 », alors que la tâche 19 est documentée comme terminée.
- Les deux README sont identiques et ne documentent pas l’installation, les variables, les tests, Supabase, la CI ou le déploiement.

## Contrôles encore non exécutés à ce stade

- Démarrage et reset Supabase local.
- Deux passages RLS et suite d’intégration complète.
- E2E authentifiés Playwright.
- Audit statique détaillé de tous les modules, migrations et Edge Functions.
- Matrice responsive, accessibilité, thèmes et captures.

Ces éléments ne seront marqués comme vérifiés qu’après exécution réelle.
