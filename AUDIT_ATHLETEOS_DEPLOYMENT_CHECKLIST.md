# Checklist de validation et de déploiement AthleteOS

Date : 1er août 2026  
Cette checklist sépare les preuves locales réellement acquises des validations serveur encore obligatoires. Elle n’autorise aucun déploiement de production automatique.

## Validé localement

- [x] `npm ci` réussi après libération du verrou Windows.
- [x] `npm run lint` : code 0, aucune erreur, 23 avertissements connus.
- [x] `npm run typecheck` : code 0.
- [x] `npm test` : 55 fichiers, 357/357.
- [x] `npm run test:coverage` : code 0; couverture métier ciblée au-dessus des seuils.
- [x] `npm run build` : code 0, 2 803 modules.
- [x] `npm audit --audit-level=high` : zéro vulnérabilité connue.
- [x] Smoke/PWA publics Chromium : 10/10.
- [x] Matrice visuelle publique Chromium : 18/18.
- [x] Thèmes clair/sombre aux huit largeurs demandées sur l’écran public.
- [x] Zoom 200 % et zoom mobile autorisés.
- [x] Manifeste, Service Worker et rechargement offline testés.
- [x] Matrice de couverture de fichiers créée avec les statuts autorisés.
- [x] Registre des problèmes et preuves de test produits.
- [x] Aucun seuil de couverture abaissé.
- [x] Aucun secret ajouté au dépôt.
- [x] Aucun déploiement ni mutation de production exécuté.

## Migrations à appliquer sur une base de test isolée

Les 44 migrations doivent être rejouées depuis zéro. Les cinq migrations ajoutées pendant l’audit sont :

1. `20260801160000_transactional_user_removal.sql`
2. `20260801170000_atomic_individual_invitation_acceptance.sql`
3. `20260801180000_iso_week_and_notification_idempotency.sql`
4. `20260801190000_atomic_existing_member_invitation_acceptance.sql`
5. `20260801200000_push_delivery_rate_limit.sql`

- [ ] Docker/Supabase fonctionnent sur le poste ou le staging choisi.
- [ ] `supabase start` réussit.
- [ ] `supabase db reset` réussit avec les 44 migrations.
- [ ] Les types DB sont régénérés et comparés à `src/types/database.types.ts`.
- [ ] Les nouvelles colonnes `iso_year` et `dedupe_key` sont présentes.
- [ ] Les index d’idempotence sont créés sans conflit de données.
- [ ] `push_delivery_attempts` est inaccessible à `anon`/`authenticated` et accessible au service role.
- [ ] Les RPC transactionnelles ne sont exécutables que par le service role.
- [ ] La suppression du dernier head coach est impossible, y compris en concurrence.
- [ ] L’acceptation concurrente d’une invitation est idempotente.
- [ ] Les semaines ISO à cheval sur le nouvel an correspondent entre JS et SQL.
- [ ] Le dimanche est inclus et les séances annulées sont exclues.
- [ ] Les quotas Push renvoient 429 aux seuils attendus.

## RLS, intégration et données

- [ ] Exécuter `npm run test:rls` après un premier reset.
- [ ] Refaire un reset complet et exécuter `npm run test:rls` une seconde fois.
- [ ] Exécuter `npm run test:integration`.
- [ ] Prouver l’isolation inter-clubs pour utilisateurs, athlètes, séances, blessures, records, performances, compétitions, invitations, messages, alertes et Push.
- [ ] Tester les vues de charge quotidienne/hebdomadaire avec l’année ISO.
- [ ] Tester la normalisation des performances et les compétitions transactionnelles.
- [ ] Tester création, modification et suppression de séance avec affectations.
- [ ] Tester les échecs intermédiaires et l’absence de données/fichiers orphelins.
- [ ] Tester les PDF privés et les policies Storage avec deux clubs.
- [ ] Vérifier les données vides, longues listes, noms longs et grands nombres.
- [ ] Définir une migration/RPC transactionnelle pour le cycle séance si le risque `AOS-DATA-002` est jugé bloquant.

## E2E authentifiés

- [ ] Préparer des comptes et données de test jetables pour deux clubs.
- [ ] Exécuter `E2E_WITH_AUTH=1 npm run test:e2e`.
- [ ] Coach : connexion, dashboard, athlètes, planning, charge, rapports, performances, compétitions, messages, réglages et déconnexion.
- [ ] Athlète : connexion, dashboard, wellness, blessure, planning, performance, club, messages, réglages et déconnexion.
- [ ] Invitations : création, révocation, régénération, expiration, mauvais email, autre club, double clic et réutilisation.
- [ ] Sécurité : interdiction inter-clubs, dernier head coach, PDF privé et Push vers autre club.
- [ ] Capturer les pages principales authentifiées en clair/sombre et aux largeurs critiques.
- [ ] Revue clavier complète, lecteur d’écran et contrastes sur les pages connectées.
- [ ] Test sur appareils réels iOS/Safari et Android/Chrome pour installation PWA et désinstallation guidée.

## Edge Functions et secrets

- [ ] Vérifier les secrets du projet de staging sans les afficher dans les logs.
- [ ] Déployer d’abord les cinq Edge Functions sur staging.
- [ ] Tester méthode HTTP, token absent/invalide, body invalide, taille maximale et erreurs contrôlées.
- [ ] Vérifier `signup`, `admin-actions`, `send-push`, `session-reminders` et `weekly-cron` avec les nouvelles migrations.
- [ ] Vérifier les logs sans email, token, endpoint Push ou détail interne sensible.
- [ ] Tester le planificateur dans le fuseau Europe/Brussels et les changements d’heure.
- [ ] Décider si `send-push` doit évoluer vers un outbox d’événements et des modèles serveur allowlistés.

## Vercel, CI et observabilité

- [ ] Pousser une branche d’audit dédiée sans les deux chemins Repomix appartenant à l’utilisateur.
- [ ] Vérifier le workflow GitHub Actions complet et ses artefacts.
- [ ] Confirmer les headers Vercel, la SPA fallback et la CSP sur une preview.
- [ ] Vérifier Sentry avec un événement de test non sensible.
- [ ] Vérifier que les sources maps et logs ne divulguent pas de secrets.
- [ ] Tester mise à jour du Service Worker, ancien cache et retour arrière.
- [ ] Vérifier sauvegardes, restauration, monitoring DB et alertes de quota.
- [ ] Faire valider RGPD : base légale, information, rétention, export et suppression.
- [ ] Faire valider scientifiquement les jauges, seuils et formulations de charge.

## Go / No-Go

État actuel : **No-Go production** et **Go conditionnel pour une preview frontend ou une bêta privée sur staging isolé**.

Avant de donner le Go à de vrais clubs, toutes les cases Supabase/RLS/intégration/E2E critiques ci-dessus doivent être cochées avec des preuves. Le blocage Docker local explique les cases ouvertes; il ne les valide pas.
