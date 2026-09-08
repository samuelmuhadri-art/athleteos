BEGIN;

-- Prépare la suppression d'un utilisateur sans supprimer le contenu sportif
-- du club qu'il a créé. Les données strictement personnelles de l'athlète
-- restent soumises au comportement historique : la suppression de sa fiche
-- cascade vers wellness, performances, blessures, affectations et social.
CREATE OR REPLACE FUNCTION public._prepare_user_content_for_removal(
  p_target_user_id integer,
  p_replacement_user_id integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target public.users%ROWTYPE;
  v_replacement public.users%ROWTYPE;
BEGIN
  SELECT * INTO v_target FROM public.users WHERE id = p_target_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'target_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_replacement FROM public.users WHERE id = p_replacement_user_id FOR UPDATE;
  IF NOT FOUND OR v_replacement.id = v_target.id
    OR v_replacement.club_id <> v_target.club_id
    OR v_replacement.role <> 'head_coach' THEN
    RAISE EXCEPTION 'invalid_content_replacement' USING ERRCODE = '42501';
  END IF;

  -- Ces colonnes sont des FK NO ACTION. Le contenu du club est transféré au
  -- responsable qui réalise/accepte le départ, plutôt que supprimé.
  UPDATE public.sessions SET created_by = v_replacement.id WHERE created_by = v_target.id;
  UPDATE public.session_series SET created_by = v_replacement.id WHERE created_by = v_target.id;
  UPDATE public.session_templates SET created_by = v_replacement.id WHERE created_by = v_target.id;
  UPDATE public.planning_events SET created_by = v_replacement.id WHERE created_by = v_target.id;

  -- Une conversation privée ne peut pas survivre avec un auteur ou un
  -- destinataire inexistant. Sa suppression fait partie du départ explicite.
  DELETE FROM public.messages
  WHERE sender_id = v_target.id OR receiver_id = v_target.id;

  -- Les anciens abonnements sans FK user_id doivent aussi être retirés.
  DELETE FROM public.push_subscriptions WHERE user_id = v_target.id;

  -- Le schéma existant cascade toutes les données propres à la fiche athlète.
  DELETE FROM public.athletes WHERE user_id = v_target.id;
END;
$$;

REVOKE ALL ON FUNCTION public._prepare_user_content_for_removal(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._prepare_user_content_for_removal(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public._prepare_user_content_for_removal(integer, integer) FROM authenticated;
REVOKE ALL ON FUNCTION public._prepare_user_content_for_removal(integer, integer) FROM service_role;

-- Renforce également la suppression d'un membre existante : elle fonctionnait
-- pour les fixtures sans contenu, mais une FK NO ACTION pouvait bloquer un
-- coach ayant déjà créé une séance, un modèle, une série ou un événement.
CREATE OR REPLACE FUNCTION public.remove_club_user_transactional(
  p_actor_user_id integer,
  p_target_user_id integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
  v_target public.users%ROWTYPE;
  v_other_head_coaches integer;
BEGIN
  SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id;
  IF NOT FOUND OR v_actor.role <> 'head_coach' THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(85001, v_actor.club_id);
  SELECT * INTO v_actor FROM public.users WHERE id = p_actor_user_id FOR UPDATE;
  SELECT * INTO v_target FROM public.users WHERE id = p_target_user_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'target_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_actor.role <> 'head_coach' OR v_target.club_id <> v_actor.club_id THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  IF v_target.id = v_actor.id THEN
    RAISE EXCEPTION 'self_removal_forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_target.role = 'head_coach' THEN
    SELECT count(*)::integer INTO v_other_head_coaches
    FROM public.users member
    WHERE member.club_id = v_actor.club_id
      AND member.role = 'head_coach'
      AND member.id <> v_target.id;
    IF v_other_head_coaches = 0 THEN
      RAISE EXCEPTION 'last_head_coach' USING ERRCODE = '23514';
    END IF;
  END IF;

  PERFORM public._prepare_user_content_for_removal(v_target.id, v_actor.id);
  DELETE FROM public.users WHERE id = v_target.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'target_delete_failed' USING ERRCODE = 'P0002'; END IF;

  RETURN jsonb_build_object('authUid', v_target.auth_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_club_user_transactional(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_club_user_transactional(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.remove_club_user_transactional(integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.remove_club_user_transactional(integer, integer) TO service_role;

-- Suppression autonome : confirmation par l'adresse du compte, sérialisation
-- des départs structurels et protection absolue du dernier head coach.
CREATE OR REPLACE FUNCTION public.delete_own_account_transactional(
  p_user_id integer,
  p_confirmation_email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_replacement_id integer;
  v_other_head_coaches integer;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_user.email IS NULL
    OR lower(btrim(coalesce(p_confirmation_email, ''))) <> lower(v_user.email) THEN
    RAISE EXCEPTION 'confirmation_email_mismatch' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(85001, v_user.club_id);
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002'; END IF;

  SELECT count(*)::integer INTO v_other_head_coaches
  FROM public.users member
  WHERE member.club_id = v_user.club_id
    AND member.role = 'head_coach'
    AND member.id <> v_user.id;

  IF v_user.role = 'head_coach' AND v_other_head_coaches = 0 THEN
    RAISE EXCEPTION 'last_head_coach' USING ERRCODE = '23514';
  END IF;

  SELECT member.id INTO v_replacement_id
  FROM public.users member
  WHERE member.club_id = v_user.club_id
    AND member.role = 'head_coach'
    AND member.id <> v_user.id
  ORDER BY member.id
  LIMIT 1;
  IF v_replacement_id IS NULL THEN
    RAISE EXCEPTION 'replacement_head_coach_missing' USING ERRCODE = '23514';
  END IF;

  -- Insérée dans la même transaction ; actor_user_id passera à NULL via la
  -- FK ON DELETE SET NULL, tandis que le snapshot minimal restera disponible.
  INSERT INTO public.audit_logs(
    actor_user_id, actor_club_id, action, target_user_id, target_club_id,
    payload, result, error_message
  ) VALUES (
    v_user.id, v_user.club_id, 'delete_own_account', v_user.id, v_user.club_id,
    jsonb_build_object('deletedUserId', v_user.id, 'deletedRole', v_user.role,
      'replacementUserId', v_replacement_id),
    'success', NULL
  );

  PERFORM public._prepare_user_content_for_removal(v_user.id, v_replacement_id);
  DELETE FROM public.users WHERE id = v_user.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_delete_failed' USING ERRCODE = 'P0002'; END IF;

  RETURN jsonb_build_object(
    'authUid', v_user.auth_uid,
    'clubId', v_user.club_id,
    'replacementUserId', v_replacement_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account_transactional(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_own_account_transactional(integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.delete_own_account_transactional(integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account_transactional(integer, text) TO service_role;

COMMIT;
