BEGIN;

-- ============================================================
-- Tâche 8 — bucket session-pdfs en stockage privé
--
-- Avant cette migration : bucket public, sans limite de taille ni de
-- type MIME côté serveur. N'importe quel lien de PDF de séance (URL
-- publique permanente) donnait accès au fichier à quiconque le devine
-- ou l'intercepte, connecté ou non — les policies INSERT/UPDATE
-- existantes (20260727010000_scope_storage_policies_by_club.sql)
-- protègent l'écriture mais jamais la LECTURE, qui contournait
-- totalement RLS via l'endpoint public.
--
-- Aucune ligne `sessions.pdf_url` n'existe en prod à ce jour (vérifié
-- avant d'écrire cette migration) : aucune conversion d'anciennes URLs
-- publiques n'est nécessaire.
--
-- social-photos n'est PAS concerné : hors périmètre de la tâche 8 (fil
-- social intentionnellement partagé dans tout le club, pas un document
-- sensible).
-- ============================================================

-- Bucket privé + limites appliquées par Supabase lui-même (et pas
-- seulement par une vérification côté client, contournable).
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 31457280, -- 30 Mo (scans/photos multi-pages)
  allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'session-pdfs';

-- Lecture : même règle que l'écriture, scopée par le 1er segment du
-- chemin (club_id). Nécessaire pour createSignedUrl() côté client, qui
-- exige que l'appelant ait un droit SELECT sur la ligne storage.objects
-- correspondante.
CREATE POLICY "club-scoped read session-pdfs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'session-pdfs'
    AND (storage.foldername(name))[1] = get_my_club_id()::text
  );

-- Suppression : nécessaire pour purger le fichier storage quand une
-- séance est supprimée (voir fix Planning.jsx deleteSession).
CREATE POLICY "club-scoped delete session-pdfs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-pdfs'
    AND (storage.foldername(name))[1] = get_my_club_id()::text
  );

COMMIT;
