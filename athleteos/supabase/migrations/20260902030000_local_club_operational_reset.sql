-- Atomic operational-data reset primitive. It is service-role only; the
-- companion script additionally refuses every non-local Supabase URL.

BEGIN;

CREATE OR REPLACE FUNCTION public.preview_club_operational_reset(p_club_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'clubId', p_club_id,
    'clubName', (SELECT name FROM public.clubs WHERE id = p_club_id),
    'counts', jsonb_build_object(
      'sessions', (SELECT count(*) FROM public.sessions WHERE club_id = p_club_id),
      'sessionAthletes', (SELECT count(*) FROM public.session_athletes sa JOIN public.sessions s ON s.id = sa.session_id WHERE s.club_id = p_club_id),
      'competitions', (SELECT count(*) FROM public.competitions WHERE club_id = p_club_id),
      'competitionAthletes', (SELECT count(*) FROM public.competition_athletes ca JOIN public.competitions c ON c.id = ca.competition_id WHERE c.club_id = p_club_id),
      'competitionResults', (SELECT count(*) FROM public.competition_results cr JOIN public.competitions c ON c.id = cr.competition_id WHERE c.club_id = p_club_id),
      'wellness', (SELECT count(*) FROM public.athlete_wellness WHERE club_id = p_club_id),
      'injuries', (SELECT count(*) FROM public.injuries i JOIN public.athletes a ON a.id = i.athlete_id WHERE a.club_id = p_club_id),
      'goals', (SELECT count(*) FROM public.athlete_goals WHERE club_id = p_club_id),
      'performances', (SELECT count(*) FROM public.athlete_performances WHERE club_id = p_club_id),
      'records', (SELECT count(*) FROM public.records r JOIN public.athletes a ON a.id = r.athlete_id WHERE a.club_id = p_club_id),
      'performanceHistory', (SELECT count(*) FROM public.performance_history h JOIN public.athletes a ON a.id = h.athlete_id WHERE a.club_id = p_club_id),
      'notifications', (SELECT count(*) FROM public.athlete_notifications WHERE club_id = p_club_id),
      'alerts', (SELECT count(*) FROM public.alerts WHERE club_id = p_club_id),
      'messages', (SELECT count(*) FROM public.messages m WHERE m.sender_id IN (SELECT id FROM public.users WHERE club_id = p_club_id) OR m.receiver_id IN (SELECT id FROM public.users WHERE club_id = p_club_id)),
      'socialPosts', (SELECT count(*) FROM public.social_posts WHERE club_id = p_club_id),
      'dailyLoadDays', (SELECT count(*) FROM public.athlete_daily_load_days d JOIN public.athletes a ON a.id = d.athlete_id WHERE a.club_id = p_club_id),
      'notificationOutbox', (SELECT count(*) FROM public.notification_outbox WHERE club_id = p_club_id)
    ),
    'preserved', jsonb_build_array('club', 'users', 'athletes', 'auth identities', 'roles', 'branding', 'club_modules', 'athlete_modules', 'invitations', 'push subscriptions', 'audit logs')
  );
$$;

CREATE OR REPLACE FUNCTION public.reset_club_operational_data(p_club_id integer, p_confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before jsonb;
  v_name text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  SELECT name INTO v_name FROM public.clubs WHERE id = p_club_id FOR UPDATE;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Club introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF upper(v_name) <> 'SMAC' OR p_confirmation <> 'SMAC' THEN
    RAISE EXCEPTION 'Confirmation SMAC requise.' USING ERRCODE = '22023';
  END IF;
  v_before := public.preview_club_operational_reset(p_club_id);

  DELETE FROM public.social_comments WHERE post_id IN (SELECT id FROM public.social_posts WHERE club_id = p_club_id);
  DELETE FROM public.social_reactions WHERE post_id IN (SELECT id FROM public.social_posts WHERE club_id = p_club_id);
  DELETE FROM public.social_posts WHERE club_id = p_club_id;
  DELETE FROM public.alerts WHERE club_id = p_club_id;
  DELETE FROM public.athlete_notifications WHERE club_id = p_club_id;
  DELETE FROM public.notification_outbox WHERE club_id = p_club_id;
  DELETE FROM public.athlete_daily_load_days WHERE athlete_id IN (SELECT id FROM public.athletes WHERE club_id = p_club_id);
  DELETE FROM public.athlete_wellness WHERE club_id = p_club_id;
  DELETE FROM public.injuries WHERE athlete_id IN (SELECT id FROM public.athletes WHERE club_id = p_club_id);
  DELETE FROM public.athlete_goals WHERE club_id = p_club_id;
  DELETE FROM public.records WHERE athlete_id IN (SELECT id FROM public.athletes WHERE club_id = p_club_id);
  DELETE FROM public.performance_history WHERE athlete_id IN (SELECT id FROM public.athletes WHERE club_id = p_club_id);
  DELETE FROM public.athlete_performances WHERE club_id = p_club_id;
  DELETE FROM public.competition_results WHERE competition_id IN (SELECT id FROM public.competitions WHERE club_id = p_club_id);
  DELETE FROM public.competition_athletes WHERE competition_id IN (SELECT id FROM public.competitions WHERE club_id = p_club_id);
  DELETE FROM public.competitions WHERE club_id = p_club_id;
  DELETE FROM public.session_athletes WHERE session_id IN (SELECT id FROM public.sessions WHERE club_id = p_club_id);
  DELETE FROM public.sessions WHERE club_id = p_club_id;
  DELETE FROM public.messages WHERE sender_id IN (SELECT id FROM public.users WHERE club_id = p_club_id) OR receiver_id IN (SELECT id FROM public.users WHERE club_id = p_club_id);

  RETURN jsonb_build_object('executed', true, 'before', v_before, 'after', public.preview_club_operational_reset(p_club_id));
END;
$$;

REVOKE ALL ON FUNCTION public.preview_club_operational_reset(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_club_operational_data(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_club_operational_reset(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_club_operational_data(integer, text) TO service_role;

COMMIT;
