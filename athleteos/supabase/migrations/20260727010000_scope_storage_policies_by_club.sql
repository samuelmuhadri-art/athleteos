BEGIN;

-- Les policies actuelles sur storage.objects ne vérifient que le bucket_id
-- ("bucket_id = 'social-photos'" etc.) — n'importe quel compte authentifié,
-- de n'importe quel club, peut donc uploader ou écraser un fichier dans le
-- dossier d'un autre club. On restreint désormais l'écriture au premier
-- segment du chemin (storage.foldername(name)[1]), qui doit correspondre
-- au club_id de l'utilisateur connecté (get_my_club_id()).
--
-- Ne casse rien de rétroactif : les fichiers déjà uploadés (chemins plats,
-- sans préfixe club) restent lisibles tels quels — les buckets sont publics
-- en lecture, ce n'est pas ce que ces policies contrôlent. Seules les
-- NOUVELLES écritures doivent désormais utiliser le préfixe `${clubId}/...`
-- (voir les changements côté client dans AthleteClub.jsx / AthletePlanning.jsx
-- / modules/Planning.jsx).

DROP POLICY IF EXISTS "authenticated upload session-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "authenticated update session-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update photos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload social photos" ON storage.objects;

CREATE POLICY "club-scoped upload session-pdfs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-pdfs'
    AND (storage.foldername(name))[1] = get_my_club_id()::text
  );

CREATE POLICY "club-scoped update session-pdfs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'session-pdfs'
    AND (storage.foldername(name))[1] = get_my_club_id()::text
  );

CREATE POLICY "club-scoped upload social-photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'social-photos'
    AND (storage.foldername(name))[1] = get_my_club_id()::text
  );

CREATE POLICY "club-scoped update social-photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'social-photos'
    AND (storage.foldername(name))[1] = get_my_club_id()::text
  );

COMMIT;
