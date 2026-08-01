# Baseline de validation Docker finale

Date de collecte : 2026-08-01 19:22:13 +02:00 (Europe/Brussels)

## Périmètre et garde-fous

- Dépôt local : `athleteos-production/athleteos`
- Branche : `audit/athleteos-complete`
- Commit de départ : `f7ed622468e756e322066aed45269f72a3a9c468`
- Environnement autorisé : Supabase local sous Docker uniquement.
- Actions explicitement exclues : reset de production, `supabase db push`, déploiement d'Edge Functions et utilisation de secrets de production.
- État utilisateur préexistant à préserver : suppression de `athleteos/repomix-output.xml` et ajout de `../repomix-output.xml`. Ces changements ne font pas partie de l'audit et resteront hors des commits.

## Machine et outillage

| Élément | Valeur observée |
| --- | --- |
| OS | Windows 11 Pro Education, version 10.0.26200, build 26200, 64 bits |
| Machine | Dell Pro 14 PC14250, x64 |
| CPU | Intel Core 3 100U, 6 cœurs, 8 processeurs logiques |
| Hyperviseur | Présent ; Hyper-V détecté par Windows |
| WSL | 2.7.11.0, noyau 6.18.33.2 ; distribution `docker-desktop` en WSL 2 |
| Node.js | v24.15.0 |
| npm | 11.12.1 |
| Docker CLI / Engine | 29.6.2 / 29.6.2, linux/amd64 |
| Docker Desktop | 4.84.0 (234817) |
| Docker Compose | v5.3.1 |
| Ressources Docker | 8 CPU, 3.67 GiB de mémoire |
| Supabase CLI | 2.109.1 |

Windows indique `VirtualizationFirmwareEnabled=False` dans WMI alors qu'un hyperviseur est effectivement actif et que Docker Engine fonctionne. La preuve fonctionnelle (daemon Docker joignable sous WSL 2) prime pour cette validation ; cette divergence d'indicateurs sera simplement conservée dans les preuves.

## Inventaire initial

| Artefact | Nombre |
| --- | ---: |
| Migrations SQL | 45 |
| Fichiers de tests unitaires/composants dans `src` | 57 |
| Scripts d'intégration `test_*.mjs` | 10 |
| Spécifications Playwright | 5 |
| Initialisation Playwright | 1 |
| Edge Functions applicatives | 5 |

Les dépendances installées sont cohérentes (`npm ls --depth=0` réussit).

## État Docker/Supabase avant démarrage

- Le daemon Docker répond correctement.
- Aucun conteneur ni aucune image n'était présent au moment de la collecte.
- La pile Supabase locale n'était pas démarrée : `supabase status` signale l'absence du conteneur `supabase_db_athleteos`.
- La configuration locale utilise les ports API `54321`, base `54322`, Studio `54323` et SMTP local `54324`.
- Les migrations et le seed local sont activés ; PostgreSQL majeur 17 est demandé.

## Problèmes et risques initiaux à reproduire

1. La validation dynamique RLS, stockage privé, RPC transactionnelles et Edge Functions n'avait pas encore pu être faite faute de Docker lors de l'audit précédent.
2. Le seed configure statiquement le bucket `session-pdfs` avec `application/pdf`, tandis que la dernière migration l'élargit aux images et documents bureautiques. Un reset local peut donc annuler la migration au moment du seed ; ce point doit être reproduit sur base vide avant correction.
3. Les parcours Playwright authentifiés et l'isolation multi-rôles doivent être rejoués contre la pile locale réelle.
4. Le fichier de mission fourni s'arrête au milieu de la phase 0 après `supabase --version`. Les phases suivantes sont donc dérivées des 30 objectifs finaux explicitement listés dans ce même document.

Cette baseline est factuelle et antérieure au démarrage de la pile locale et à toute correction issue de la validation.
