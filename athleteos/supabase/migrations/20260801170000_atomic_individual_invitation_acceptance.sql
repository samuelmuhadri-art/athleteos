BEGIN;

-- Enveloppe transactionnelle du RPC historique : pour une invitation
-- individuelle, la création/réclamation du compte métier et la consommation
-- du lien réussissent ensemble ou sont toutes deux annulées.
CREATE OR REPLACE FUNCTION public.signup_create_account_with_invitation(
  p_mode text,
  p_club_name text,
  p_invite_code text,
  p_auth_uid text,
  p_name text,
  p_email text,
  p_individual_invitation_id uuid,
  p_reservation_token uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invitation public.club_invitations%ROWTYPE;
  v_club_invite_code text;
  v_result jsonb;
  v_updated_count integer;
BEGIN
  IF p_individual_invitation_id IS NULL THEN
    RETURN public.signup_create_account(
      p_mode, p_club_name, p_invite_code, p_auth_uid, p_name, p_email
    );
  END IF;

  IF p_mode <> 'join_club' OR p_reservation_token IS NULL THEN
    RAISE EXCEPTION 'invalid_individual_invitation_context' USING ERRCODE = '22023';
  END IF;

  SELECT invitation.* INTO v_invitation
  FROM public.club_invitations invitation
  WHERE invitation.id = p_individual_invitation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_invitation.status <> 'active' OR v_invitation.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation_not_active' USING ERRCODE = '23514';
  END IF;
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'invitation_expired' USING ERRCODE = '23514';
  END IF;
  IF v_invitation.reservation_token IS DISTINCT FROM p_reservation_token
    OR v_invitation.reserved_until IS NULL
    OR v_invitation.reserved_until <= now()
  THEN
    RAISE EXCEPTION 'invitation_reservation_lost' USING ERRCODE = '40001';
  END IF;
  IF v_invitation.recipient_email IS NOT NULL
    AND lower(btrim(v_invitation.recipient_email)) <> lower(btrim(coalesce(p_email, '')))
  THEN
    RAISE EXCEPTION 'invitation_email_mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT club.invite_code INTO v_club_invite_code
  FROM public.clubs club
  WHERE club.id = v_invitation.club_id;
  IF NOT FOUND OR upper(btrim(v_club_invite_code)) <> upper(btrim(coalesce(p_invite_code, ''))) THEN
    RAISE EXCEPTION 'invitation_club_mismatch' USING ERRCODE = '42501';
  END IF;

  v_result := public.signup_create_account(
    p_mode, p_club_name, p_invite_code, p_auth_uid, p_name, p_email
  );

  UPDATE public.club_invitations
  SET accepted_at = now(),
      accepted_user_id = (v_result ->> 'userId')::integer,
      reservation_token = NULL,
      reserved_until = NULL
  WHERE id = v_invitation.id
    AND status = 'active'
    AND accepted_at IS NULL
    AND reservation_token = p_reservation_token;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'invitation_acceptance_conflict' USING ERRCODE = '40001';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.signup_create_account_with_invitation(text, text, text, text, text, text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.signup_create_account_with_invitation(text, text, text, text, text, text, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.signup_create_account_with_invitation(text, text, text, text, text, text, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.signup_create_account_with_invitation(text, text, text, text, text, text, uuid, uuid) TO service_role;

COMMIT;
