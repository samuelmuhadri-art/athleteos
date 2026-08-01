BEGIN;

-- Consomme une invitation individuelle pour un compte déjà existant sous
-- verrou de ligne. Deux clics concurrents deviennent idempotents pour le même
-- utilisateur et ne peuvent jamais annoncer un succès à deux utilisateurs.
CREATE OR REPLACE FUNCTION public.accept_existing_member_club_invitation(
  p_invitation_id uuid,
  p_user_id integer,
  p_email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invitation public.club_invitations%ROWTYPE;
  v_user_club_id integer;
  v_club_name text;
BEGIN
  SELECT invitation.* INTO v_invitation
  FROM public.club_invitations invitation
  WHERE invitation.id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF v_invitation.accepted_at IS NOT NULL THEN
    IF v_invitation.accepted_user_id = p_user_id THEN
      SELECT name INTO v_club_name FROM public.clubs WHERE id = v_invitation.club_id;
      RETURN jsonb_build_object('status', 'accepted_by_caller', 'clubName', coalesce(v_club_name, 'Ton club'));
    END IF;
    RETURN jsonb_build_object('status', 'accepted');
  END IF;

  IF v_invitation.status = 'revoked' THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;
  IF v_invitation.recipient_email IS NOT NULL
    AND lower(btrim(v_invitation.recipient_email)) <> lower(btrim(coalesce(p_email, '')))
  THEN
    RETURN jsonb_build_object('status', 'email_mismatch');
  END IF;

  SELECT app_user.club_id INTO v_user_club_id
  FROM public.users app_user
  WHERE app_user.id = p_user_id;
  IF NOT FOUND OR v_user_club_id <> v_invitation.club_id THEN
    RETURN jsonb_build_object('status', 'different_club');
  END IF;

  UPDATE public.club_invitations
  SET accepted_at = now(),
      accepted_user_id = p_user_id,
      reservation_token = NULL,
      reserved_until = NULL
  WHERE id = v_invitation.id;

  SELECT name INTO v_club_name FROM public.clubs WHERE id = v_invitation.club_id;
  RETURN jsonb_build_object('status', 'accepted_by_caller', 'clubName', coalesce(v_club_name, 'Ton club'));
END;
$$;

REVOKE ALL ON FUNCTION public.accept_existing_member_club_invitation(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_existing_member_club_invitation(uuid, integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.accept_existing_member_club_invitation(uuid, integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_existing_member_club_invitation(uuid, integer, text) TO service_role;

COMMIT;
