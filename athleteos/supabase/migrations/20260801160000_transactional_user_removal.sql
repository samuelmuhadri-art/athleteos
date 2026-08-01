BEGIN;

-- Suppression métier tout-ou-rien. Cette migration ne supprime aucune donnée
-- à son application : elle expose uniquement l'opération appelée explicitement
-- par admin-actions après confirmation du head coach.
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
  SELECT actor.* INTO v_actor
  FROM public.users actor
  WHERE actor.id = p_actor_user_id;
  IF NOT FOUND OR v_actor.role <> 'head_coach' THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  -- Sérialise les mutations structurelles d'un même club avant de verrouiller
  -- les lignes utilisateur, afin d'éviter deux suppressions concurrentes.
  PERFORM pg_advisory_xact_lock(85001, v_actor.club_id);

  SELECT actor.* INTO v_actor
  FROM public.users actor
  WHERE actor.id = p_actor_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_actor.role <> 'head_coach' THEN
    RAISE EXCEPTION 'actor_no_longer_authorized' USING ERRCODE = '42501';
  END IF;
  SELECT target.* INTO v_target
  FROM public.users target
  WHERE target.id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'target_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_target.club_id <> v_actor.club_id THEN
    RAISE EXCEPTION 'cross_club_target' USING ERRCODE = '42501';
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

  -- Les dépendances athlete_id configurées ON DELETE CASCADE sont supprimées
  -- dans cette même transaction. Si users ne peut ensuite pas être supprimé,
  -- PostgreSQL annule également ce premier DELETE.
  DELETE FROM public.athletes WHERE user_id = v_target.id;
  DELETE FROM public.users WHERE id = v_target.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'target_delete_failed' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('authUid', v_target.auth_uid);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_club_user_transactional(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_club_user_transactional(integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.remove_club_user_transactional(integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.remove_club_user_transactional(integer, integer) TO service_role;

COMMIT;
