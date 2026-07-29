BEGIN;

CREATE TABLE IF NOT EXISTS public.club_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id integer NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  code text NOT NULL,
  recipient_name text,
  recipient_email text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  expires_at timestamptz,
  opened_at timestamptz,
  accepted_at timestamptz,
  accepted_user_id integer REFERENCES public.users(id) ON DELETE SET NULL,
  reservation_token uuid,
  reserved_until timestamptz,
  revoked_at timestamptz,
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_invitations_code_format_check CHECK (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'),
  CONSTRAINT club_invitations_recipient_name_check CHECK (recipient_name IS NULL OR char_length(btrim(recipient_name)) BETWEEN 1 AND 100),
  CONSTRAINT club_invitations_recipient_email_check CHECK (recipient_email IS NULL OR char_length(recipient_email) <= 254)
);

CREATE UNIQUE INDEX IF NOT EXISTS club_invitations_code_normalized_idx
  ON public.club_invitations (upper(btrim(code)));
CREATE INDEX IF NOT EXISTS club_invitations_club_created_idx
  ON public.club_invitations (club_id, created_at DESC);

ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.club_invitations FROM anon, authenticated;
-- Aucune policy cliente : les coordonnées et l'historique sont servis par
-- admin-actions après vérification head_coach. L'inspection publique ci-dessous
-- ne renvoie ni nom du destinataire, ni email, ni identifiant interne.

CREATE OR REPLACE FUNCTION public.inspect_club_invitation(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
  v_invitation public.club_invitations%ROWTYPE;
  v_club_name text;
  v_status text;
BEGIN
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[[:space:]-]+', '', 'g'));
  IF v_code !~ '^[A-Z0-9]{8}$' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT invitation, club.name
  INTO v_invitation, v_club_name
  FROM public.club_invitations invitation
  JOIN public.clubs club ON club.id = invitation.club_id
  WHERE upper(btrim(invitation.code)) = v_code
  LIMIT 1;

  IF FOUND THEN
    v_status := CASE
      WHEN v_invitation.status = 'revoked' THEN 'revoked'
      WHEN v_invitation.accepted_at IS NOT NULL THEN 'accepted'
      WHEN v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= now() THEN 'expired'
      ELSE 'active'
    END;
    IF v_status = 'active' AND v_invitation.opened_at IS NULL THEN
      UPDATE public.club_invitations SET opened_at = now() WHERE id = v_invitation.id;
    END IF;
    RETURN jsonb_build_object(
      'status', v_status,
      'kind', 'individual',
      'clubName', v_club_name,
      'expiresAt', v_invitation.expires_at
    );
  END IF;

  SELECT club.name
  INTO v_club_name
  FROM public.clubs club
  WHERE upper(btrim(club.invite_code)) = v_code
    AND (club.invite_code_expires_at IS NULL OR club.invite_code_expires_at > now())
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'active', 'kind', 'club', 'clubName', v_club_name);
  END IF;

  RETURN jsonb_build_object('status', 'invalid');
END;
$$;

REVOKE ALL ON FUNCTION public.inspect_club_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inspect_club_invitation(text) TO anon, authenticated;

COMMIT;
