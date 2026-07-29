BEGIN;

-- Réparation additive pour les environnements où l'identité visuelle a été
-- déployée sans son bucket. Le client ne reçoit plus "Bucket not found" et
-- les limites sont identiques à celles validées par l'Edge Function.
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS cover_path text,
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#1D9E75',
  ADD COLUMN IF NOT EXISTS invite_code_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_code_use_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invite_code_last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS invite_code_expires_at timestamptz;

UPDATE public.clubs
SET
  invite_code = upper(btrim(invite_code)),
  invite_code_created_at = coalesce(invite_code_created_at, now())
WHERE invite_code IS NOT NULL;

ALTER TABLE public.clubs
  DROP CONSTRAINT IF EXISTS clubs_invite_code_use_count_check;
ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_invite_code_use_count_check CHECK (invite_code_use_count >= 0);

DROP INDEX IF EXISTS public.clubs_invite_code_normalized_idx;
CREATE UNIQUE INDEX clubs_invite_code_normalized_idx
  ON public.clubs (upper(btrim(invite_code)))
  WHERE invite_code IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club-branding', 'club-branding', false, 5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "club members read club-branding" ON storage.objects;
CREATE POLICY "club members read club-branding" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'club-branding'
    AND (storage.foldername(name))[1] = public.get_my_club_id()::text
  );

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

-- Le compteur est modifié côté serveur après une inscription réussie. La
-- comparaison accepte les anciens codes contenant 0/1/I/L/O.
CREATE OR REPLACE FUNCTION public.mark_club_invitation_used(p_invite_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.clubs
  SET
    invite_code_use_count = invite_code_use_count + 1,
    invite_code_last_used_at = now()
  WHERE upper(btrim(invite_code)) = upper(btrim(p_invite_code))
    AND (invite_code_expires_at IS NULL OR invite_code_expires_at > now());
END;
$$;

REVOKE ALL ON FUNCTION public.mark_club_invitation_used(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_club_invitation_used(text) FROM anon;
REVOKE ALL ON FUNCTION public.mark_club_invitation_used(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_club_invitation_used(text) TO service_role;

COMMIT;
