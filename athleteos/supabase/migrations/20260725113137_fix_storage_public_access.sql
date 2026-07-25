BEGIN;

-- session-pdfs : ajoute upload/update pour authenticated (nécessaire pour upsert:true,
-- utilisé par AthletePlanning.jsx et Planning.jsx), puis retire l'accès anonyme total
-- (n'importe qui pouvait uploader des fichiers sans être connecté).
CREATE POLICY "authenticated upload session-pdfs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'session-pdfs');

CREATE POLICY "authenticated update session-pdfs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'session-pdfs');

DROP POLICY IF EXISTS "Public upload access session-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Public read access session-pdfs" ON storage.objects;

-- social-photos : l'upload authentifié et l'update existent déjà et suffisent
-- (AthleteClub.jsx uploade toujours via un utilisateur connecté).
-- Retire l'upload public ouvert à tous + les 2 policies de lecture publiques
-- redondantes (l'app ne fait jamais de .list(), et getPublicUrl() n'a besoin
-- d'aucune policy vu que le bucket est déjà public côté fichier).
DROP POLICY IF EXISTS "Public upload access social-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access on social-photos" ON storage.objects;
DROP POLICY IF EXISTS "public read social photos" ON storage.objects;

COMMIT;
