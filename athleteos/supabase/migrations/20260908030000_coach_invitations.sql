BEGIN;
ALTER TABLE public.club_invitations ADD COLUMN target_role text NOT NULL DEFAULT 'athlete'
  CHECK (target_role IN ('athlete', 'coach'));
ALTER TABLE public.club_invitations ADD CONSTRAINT coach_invitation_named_email
  CHECK (target_role <> 'coach' OR nullif(btrim(recipient_email), '') IS NOT NULL);

-- Keep the proven athlete/import transaction unchanged; coach invitations
-- create a staff profile, never a spurious athlete record.
ALTER FUNCTION public.signup_create_account_with_invitation(text,text,text,text,text,text,uuid,uuid)
  RENAME TO signup_create_athlete_account_with_invitation;
CREATE FUNCTION public.signup_create_account_with_invitation(
  p_mode text, p_club_name text, p_invite_code text, p_auth_uid text,
  p_name text, p_email text, p_individual_invitation_id uuid, p_reservation_token uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_inv public.club_invitations; v_user_id integer;
BEGIN
  SELECT * INTO v_inv FROM public.club_invitations WHERE id = p_individual_invitation_id FOR UPDATE;
  IF v_inv.id IS NULL OR v_inv.target_role = 'athlete' THEN
    RETURN public.signup_create_athlete_account_with_invitation(p_mode,p_club_name,p_invite_code,p_auth_uid,p_name,p_email,p_individual_invitation_id,p_reservation_token);
  END IF;
  IF p_mode IS DISTINCT FROM 'join_club' OR v_inv.status <> 'active' OR v_inv.accepted_at IS NOT NULL
    OR v_inv.expires_at <= now() OR v_inv.reservation_token IS DISTINCT FROM p_reservation_token
    OR p_reservation_token IS NULL OR v_inv.reserved_until IS NULL OR v_inv.reserved_until <= now()
    OR lower(btrim(v_inv.recipient_email)) IS DISTINCT FROM lower(btrim(p_email))
    OR NOT EXISTS (SELECT 1 FROM public.clubs WHERE id=v_inv.club_id AND invite_code=p_invite_code)
    OR NOT EXISTS (SELECT 1 FROM public.users WHERE id=v_inv.created_by AND club_id=v_inv.club_id AND role='head_coach')
  THEN RAISE EXCEPTION 'Invitation coach inactive ou non autorisée' USING ERRCODE='42501'; END IF;
  IF nullif(btrim(p_name),'') IS NULL OR length(p_name)>100
    OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id::text=p_auth_uid AND lower(email)=lower(btrim(p_email)))
  THEN RAISE EXCEPTION 'Identité invalide' USING ERRCODE='22023'; END IF;
  INSERT INTO public.users(club_id,name,email,role,auth_uid)
    VALUES(v_inv.club_id,btrim(p_name),lower(btrim(p_email)),'coach',p_auth_uid) RETURNING id INTO v_user_id;
  UPDATE public.club_invitations SET accepted_at=now(), accepted_user_id=v_user_id,
    reservation_token=NULL,reserved_until=NULL WHERE id=v_inv.id;
  RETURN jsonb_build_object('userId',v_user_id,'clubId',v_inv.club_id,'role','coach');
END $$;
REVOKE ALL ON FUNCTION public.signup_create_account_with_invitation(text,text,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.signup_create_account_with_invitation(text,text,text,text,text,text,uuid,uuid) TO service_role;

-- Inspection remains anonymous and exposes no recipient identity.
ALTER FUNCTION public.inspect_club_invitation(text) RENAME TO inspect_club_invitation_without_role;
CREATE FUNCTION public.inspect_club_invitation(p_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb; v_role text;
BEGIN
  v_result := public.inspect_club_invitation_without_role(p_code);
  IF v_result->>'kind'='individual' THEN
    SELECT target_role INTO v_role FROM public.club_invitations
      WHERE code=upper(regexp_replace(coalesce(p_code,''),'[[:space:]-]+','','g'));
  END IF;
  RETURN v_result || jsonb_build_object('targetRole',coalesce(v_role,'athlete'));
END $$;
REVOKE ALL ON FUNCTION public.inspect_club_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inspect_club_invitation(text) TO anon,authenticated;
COMMIT;
