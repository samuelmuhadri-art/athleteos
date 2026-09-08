BEGIN;

-- Private presentation preferences, separate from the club-readable user profile.
CREATE TABLE public.coach_dashboard_preferences (
  user_id bigint PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  club_id bigint NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coach_dashboard_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_dashboard_preferences FROM anon, authenticated;
GRANT SELECT ON public.coach_dashboard_preferences TO authenticated;
GRANT ALL ON public.coach_dashboard_preferences TO service_role;
CREATE POLICY dashboard_preferences_owner ON public.coach_dashboard_preferences FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_id AND u.auth_uid::text = auth.uid()::text AND u.club_id = coach_dashboard_preferences.club_id AND u.role IN ('coach','head_coach')));

CREATE FUNCTION public.get_my_dashboard_preferences() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user public.users; v_result jsonb;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE auth_uid::text = auth.uid()::text;
  IF v_user.id IS NULL OR coalesce(v_user.role,'') NOT IN ('coach','head_coach') OR v_user.club_id IS NULL THEN
    RAISE EXCEPTION 'Accès réservé aux coachs du club' USING ERRCODE = '42501';
  END IF;
  SELECT preferences INTO v_result FROM public.coach_dashboard_preferences WHERE user_id = v_user.id AND club_id = v_user.club_id;
  RETURN coalesce(v_result, '{}'::jsonb);
END $$;

CREATE FUNCTION public.configure_my_dashboard_preferences(p_preferences jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user public.users; v_key text; v_group text;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE auth_uid::text = auth.uid()::text FOR UPDATE;
  IF v_user.id IS NULL OR coalesce(v_user.role,'') NOT IN ('coach','head_coach') OR v_user.club_id IS NULL THEN
    RAISE EXCEPTION 'Accès réservé aux coachs du club' USING ERRCODE = '42501';
  END IF;
  IF p_preferences IS NULL OR jsonb_typeof(p_preferences) <> 'object' OR octet_length(p_preferences::text) > 2048 THEN
    RAISE EXCEPTION 'Préférences invalides' USING ERRCODE = '22023';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_preferences) LOOP
    IF v_key NOT IN ('order','hidden','defaultGroup','feedbackDays') THEN RAISE EXCEPTION 'Option inconnue' USING ERRCODE = '22023'; END IF;
  END LOOP;
  IF jsonb_typeof(p_preferences->'order') IS DISTINCT FROM 'array' OR jsonb_typeof(p_preferences->'hidden') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Liste de blocs invalide' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_preferences->'order') <> 4
    OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_preferences->'order')) <> 4
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_preferences->'order') WHERE value NOT IN ('priorities','wellness','overview','followup') OR value IS NULL)
    OR jsonb_array_length(p_preferences->'hidden') > 8
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_preferences->'hidden') WHERE value NOT IN ('priorities','wellness','overview','followup','athletes','competitions','goals','feedback') OR value IS NULL)
    OR (p_preferences->'feedbackDays') IS NULL OR (p_preferences->'feedbackDays') NOT IN ('7'::jsonb,'14'::jsonb,'28'::jsonb) THEN
    RAISE EXCEPTION 'Bloc ou période invalide' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_preferences->'defaultGroup') IS DISTINCT FROM 'null' AND jsonb_typeof(p_preferences->'defaultGroup') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'Groupe invalide' USING ERRCODE = '22023';
  END IF;
  v_group := p_preferences->>'defaultGroup';
  IF v_group IS NOT NULL AND (length(v_group) > 120 OR NOT EXISTS (SELECT 1 FROM public.athletes WHERE club_id = v_user.club_id AND group_name = v_group)) THEN
    RAISE EXCEPTION 'Ce groupe n’existe plus dans ton club' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.coach_dashboard_preferences(user_id,club_id,preferences) VALUES(v_user.id,v_user.club_id,p_preferences)
  ON CONFLICT(user_id) DO UPDATE SET club_id=excluded.club_id, preferences=excluded.preferences, updated_at=now();
  RETURN p_preferences;
END $$;
REVOKE ALL ON FUNCTION public.get_my_dashboard_preferences() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.configure_my_dashboard_preferences(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_dashboard_preferences(), public.configure_my_dashboard_preferences(jsonb) TO authenticated;
COMMIT;
