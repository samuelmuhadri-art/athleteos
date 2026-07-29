BEGIN;

-- ============================================================
-- Personnalisation visuelle du club
--
-- Les chemins sont stockés (et non des URL signées temporaires) afin
-- que le client puisse générer une URL courte durée au moment de
-- l'affichage. Toutes les colonnes sont additives : les clubs existants
-- gardent leur fonctionnement et reçoivent simplement la couleur
-- AthleteOS historique comme valeur par défaut.
-- ============================================================

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS cover_path text,
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#1D9E75';

-- Défense en profondeur : même service_role ne peut pas enregistrer
-- accidentellement l'image d'un autre club ou une URL externe dans la
-- fiche. Le premier segment du chemin doit toujours être l'id de la ligne.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clubs'::regclass
      AND conname = 'clubs_accent_color_hex_check'
  ) THEN
    ALTER TABLE public.clubs
      ADD CONSTRAINT clubs_accent_color_hex_check
      CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clubs'::regclass
      AND conname = 'clubs_logo_path_scoped_check'
  ) THEN
    ALTER TABLE public.clubs
      ADD CONSTRAINT clubs_logo_path_scoped_check
      CHECK (
        logo_path IS NULL OR (
          logo_path LIKE (id::text || '/%')
          AND char_length(logo_path) <= 500
          AND position('..' IN logo_path) = 0
          AND position('//' IN logo_path) = 0
          AND position('?' IN logo_path) = 0
          AND position('#' IN logo_path) = 0
          AND position(chr(92) IN logo_path) = 0
          AND logo_path ~* '\.(png|jpe?g|webp)$'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clubs'::regclass
      AND conname = 'clubs_cover_path_scoped_check'
  ) THEN
    ALTER TABLE public.clubs
      ADD CONSTRAINT clubs_cover_path_scoped_check
      CHECK (
        cover_path IS NULL OR (
          cover_path LIKE (id::text || '/%')
          AND char_length(cover_path) <= 500
          AND position('..' IN cover_path) = 0
          AND position('//' IN cover_path) = 0
          AND position('?' IN cover_path) = 0
          AND position('#' IN cover_path) = 0
          AND position(chr(92) IN cover_path) = 0
          AND cover_path ~* '\.(png|jpe?g|webp)$'
        )
      );
  END IF;
END;
$$;

COMMENT ON COLUMN public.clubs.logo_path IS
  'Chemin privé dans le bucket club-branding, préfixé par le club_id.';
COMMENT ON COLUMN public.clubs.cover_path IS
  'Chemin privé de la couverture dans club-branding, préfixé par le club_id.';
COMMENT ON COLUMN public.clubs.accent_color IS
  'Couleur d''accent du club au format hexadécimal strict #RRGGBB.';

-- Bucket volontairement privé. Supabase contrôle la taille et le MIME
-- côté serveur ; le client ne peut donc pas contourner ces limites.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club-branding',
  'club-branding',
  false,
  5242880, -- 5 Mo
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Les membres voient uniquement les images de leur club. Cette policy est
-- nécessaire à createSignedUrl() sur un bucket privé.
DROP POLICY IF EXISTS "club members read club-branding" ON storage.objects;
CREATE POLICY "club members read club-branding" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'club-branding'
    AND (storage.foldername(name))[1] = public.get_my_club_id()::text
  );

-- Seul le head coach peut modifier l'identité visuelle. WITH CHECK sur
-- UPDATE empêche aussi de déplacer un objet vers le dossier d'un autre
-- club pendant un remplacement/upsert.
DROP POLICY IF EXISTS "head coach upload club-branding" ON storage.objects;
CREATE POLICY "head coach upload club-branding" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-branding'
    AND public.get_my_role() = 'head_coach'
    AND (storage.foldername(name))[1] = public.get_my_club_id()::text
  );

DROP POLICY IF EXISTS "head coach update club-branding" ON storage.objects;
CREATE POLICY "head coach update club-branding" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'club-branding'
    AND public.get_my_role() = 'head_coach'
    AND (storage.foldername(name))[1] = public.get_my_club_id()::text
  )
  WITH CHECK (
    bucket_id = 'club-branding'
    AND public.get_my_role() = 'head_coach'
    AND (storage.foldername(name))[1] = public.get_my_club_id()::text
  );

DROP POLICY IF EXISTS "head coach delete club-branding" ON storage.objects;
CREATE POLICY "head coach delete club-branding" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-branding'
    AND public.get_my_role() = 'head_coach'
    AND (storage.foldername(name))[1] = public.get_my_club_id()::text
  );

COMMIT;
