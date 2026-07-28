-- ============================================================
-- AthleteOS — supabase/seed.sql
--
-- Exécuté automatiquement par `supabase start`/`supabase db reset` APRÈS
-- toutes les migrations, uniquement en local — jamais par `supabase db
-- push` (qui ne touche que le schéma versionné, pas ce fichier). Sert à
-- recréer, en local, l'état d'infrastructure qui existe en production
-- mais n'a jamais été versionné dans une migration : les buckets de
-- stockage `session-pdfs` et `social-photos` ont été créés à la main
-- dans le dashboard Supabase (voir migrations 20260725113137/
-- 20260727010000 pour leurs policies, qui elles SONT versionnées).
--
-- Sans ce fichier, une instance Supabase locale fraîche (comme celle
-- démarrée en CI par .github/workflows/rls-check.yml, tâche 7) n'aurait
-- aucun bucket, et les tests storage.objects de test_rls_regression.mjs
-- échoueraient pour une raison sans rapport avec RLS ("Bucket not
-- found").
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('session-pdfs', 'session-pdfs', true),
  ('social-photos', 'social-photos', true)
ON CONFLICT (id) DO NOTHING;
