-- AthleteOS — make gamification optional and support atomic tool-to-athletes management.
-- Additive migration: badge history and every existing operational row are preserved.

BEGIN;

ALTER TABLE public.club_modules DROP CONSTRAINT IF EXISTS club_modules_key_check;
ALTER TABLE public.club_modules ADD CONSTRAINT club_modules_key_check CHECK (module_key = ANY (ARRAY[
  'planning', 'performances', 'session_feedback', 'wellness',
  'training_load', 'health', 'messaging', 'social', 'reports', 'gamification'
]::text[]));

ALTER TABLE public.athlete_modules DROP CONSTRAINT IF EXISTS athlete_modules_key_check;
ALTER TABLE public.athlete_modules ADD CONSTRAINT athlete_modules_key_check CHECK (module_key = ANY (ARRAY[
  'planning', 'performances', 'session_feedback', 'wellness',
  'training_load', 'health', 'messaging', 'social', 'reports', 'gamification'
]::text[]));

-- Backward compatibility: existing users keep their current experience until a coach changes it.
INSERT INTO public.club_modules (club_id, module_key, enabled)
SELECT id, 'gamification', true FROM public.clubs
ON CONFLICT (club_id, module_key) DO NOTHING;

INSERT INTO public.athlete_modules (athlete_id, club_id, module_key, enabled)
SELECT id, club_id, 'gamification', true FROM public.athletes
ON CONFLICT (athlete_id, module_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.seed_club_modules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.club_modules (club_id, module_key, enabled)
  SELECT NEW.id, key, true
  FROM unnest(ARRAY[
    'planning', 'performances', 'session_feedback', 'wellness',
    'training_load', 'health', 'messaging', 'social', 'reports', 'gamification'
  ]::text[]) AS key
  ON CONFLICT (club_id, module_key) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_athlete_modules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.athlete_modules (athlete_id, club_id, module_key, enabled)
  SELECT NEW.id, NEW.club_id, key, true
  FROM unnest(ARRAY[
    'planning', 'performances', 'session_feedback', 'wellness',
    'training_load', 'health', 'messaging', 'social', 'reports', 'gamification'
  ]::text[]) AS key
  ON CONFLICT (athlete_id, module_key) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.configure_my_club_modules(p_enabled_module_keys text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_club_id integer := public.get_my_club_id();
  v_user_id integer := public.get_my_user_id();
  v_allowed constant text[] := ARRAY[
    'planning', 'performances', 'session_feedback', 'wellness',
    'training_load', 'health', 'messaging', 'social', 'reports', 'gamification'
  ]::text[];
  v_enabled text[] := COALESCE(p_enabled_module_keys, ARRAY[]::text[]);
BEGIN
  IF v_club_id IS NULL OR public.get_my_role() <> 'head_coach' THEN
    RAISE EXCEPTION 'Action réservée au head coach.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_enabled) key WHERE NOT key = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Outil inconnu.' USING ERRCODE = '22023';
  END IF;
  IF 'training_load' = ANY(v_enabled) AND NOT ('session_feedback' = ANY(v_enabled)) THEN
    RAISE EXCEPTION 'La charge nécessite le feedback de séance.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.club_modules (club_id, module_key, enabled, updated_by)
  SELECT v_club_id, key, key = ANY(v_enabled), v_user_id FROM unnest(v_allowed) key
  ON CONFLICT (club_id, module_key) DO UPDATE
    SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by;

  UPDATE public.clubs SET modules_configured_at = now() WHERE id = v_club_id;
  RETURN jsonb_build_object('clubId', v_club_id, 'enabledModuleKeys', to_jsonb(v_enabled));
END;
$$;

CREATE OR REPLACE FUNCTION public.configure_athlete_modules(
  p_athlete_ids integer[],
  p_enabled_module_keys text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_club_id integer := public.get_my_club_id();
  v_user_id integer := public.get_my_user_id();
  v_role text := public.get_my_role();
  v_ids integer[] := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_athlete_ids, ARRAY[]::integer[])) x);
  v_allowed constant text[] := ARRAY[
    'planning', 'performances', 'session_feedback', 'wellness',
    'training_load', 'health', 'messaging', 'social', 'reports', 'gamification'
  ]::text[];
  v_enabled text[] := COALESCE(p_enabled_module_keys, ARRAY[]::text[]);
BEGIN
  IF v_club_id IS NULL OR v_role NOT IN ('coach', 'head_coach') THEN
    RAISE EXCEPTION 'Action réservée aux coachs.' USING ERRCODE = '42501';
  END IF;
  IF cardinality(v_ids) = 0 THEN
    RAISE EXCEPTION 'Sélectionne au moins un athlète.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_ids) athlete_id
             LEFT JOIN public.athletes a ON a.id = athlete_id
             WHERE a.id IS NULL OR a.club_id <> v_club_id) THEN
    RAISE EXCEPTION 'Athlète hors de ton effectif.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_enabled) key WHERE NOT key = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Outil inconnu.' USING ERRCODE = '22023';
  END IF;
  IF 'training_load' = ANY(v_enabled) AND NOT ('session_feedback' = ANY(v_enabled)) THEN
    RAISE EXCEPTION 'La charge nécessite le feedback de séance.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.athlete_modules (athlete_id, club_id, module_key, enabled, updated_by)
  SELECT athlete_id, v_club_id, key, key = ANY(v_enabled), v_user_id
  FROM unnest(v_ids) athlete_id CROSS JOIN unnest(v_allowed) key
  ON CONFLICT (athlete_id, module_key) DO UPDATE
    SET enabled = EXCLUDED.enabled, club_id = EXCLUDED.club_id, updated_by = EXCLUDED.updated_by;

  RETURN jsonb_build_object('athleteIds', to_jsonb(v_ids), 'enabledModuleKeys', to_jsonb(v_enabled));
END;
$$;

-- The inverse management path: one tool, then the athletes who use it.
CREATE OR REPLACE FUNCTION public.configure_module_athletes(
  p_module_key text,
  p_enabled_athlete_ids integer[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_club_id integer := public.get_my_club_id();
  v_user_id integer := public.get_my_user_id();
  v_role text := public.get_my_role();
  v_enabled_ids integer[] := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_enabled_athlete_ids, ARRAY[]::integer[])) x);
  v_allowed constant text[] := ARRAY[
    'planning', 'performances', 'session_feedback', 'wellness',
    'training_load', 'health', 'messaging', 'social', 'reports', 'gamification'
  ]::text[];
BEGIN
  IF v_club_id IS NULL OR v_role NOT IN ('coach', 'head_coach') THEN
    RAISE EXCEPTION 'Action réservée aux coachs.' USING ERRCODE = '42501';
  END IF;
  IF NOT p_module_key = ANY(v_allowed) THEN
    RAISE EXCEPTION 'Outil inconnu.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_enabled_ids) athlete_id
             LEFT JOIN public.athletes a ON a.id = athlete_id
             WHERE a.id IS NULL OR a.club_id <> v_club_id) THEN
    RAISE EXCEPTION 'Athlète hors de ton effectif.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_club_module_enabled(v_club_id, p_module_key) THEN
    RAISE EXCEPTION 'Cet outil est désactivé au niveau du club.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.athlete_modules (athlete_id, club_id, module_key, enabled, updated_by)
  SELECT a.id, v_club_id, p_module_key, a.id = ANY(v_enabled_ids), v_user_id
  FROM public.athletes a WHERE a.club_id = v_club_id
  ON CONFLICT (athlete_id, module_key) DO UPDATE
    SET enabled = EXCLUDED.enabled, club_id = EXCLUDED.club_id, updated_by = EXCLUDED.updated_by;

  -- Keep the existing dependency invariant in both directions.
  IF p_module_key = 'training_load' AND cardinality(v_enabled_ids) > 0 THEN
    INSERT INTO public.athlete_modules (athlete_id, club_id, module_key, enabled, updated_by)
    SELECT a.id, v_club_id, 'session_feedback', true, v_user_id
    FROM public.athletes a WHERE a.club_id = v_club_id AND a.id = ANY(v_enabled_ids)
    ON CONFLICT (athlete_id, module_key) DO UPDATE SET enabled = true, updated_by = EXCLUDED.updated_by;
  ELSIF p_module_key = 'session_feedback' THEN
    UPDATE public.athlete_modules
       SET enabled = false, updated_by = v_user_id
     WHERE club_id = v_club_id AND module_key = 'training_load' AND NOT (athlete_id = ANY(v_enabled_ids));
  END IF;

  RETURN jsonb_build_object('moduleKey', p_module_key, 'enabledAthleteIds', to_jsonb(v_enabled_ids));
END;
$$;

CREATE OR REPLACE FUNCTION public.module_key_for_notification_type(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_type IN ('new_session', 'session_updated', 'session_day_reminder', 'session_response', 'athlete_session') THEN 'planning'
    WHEN p_type IN ('session_feedback_reminder', 'weekly_recap', 'recap', 'absence') THEN 'session_feedback'
    WHEN p_type IN ('result_added', 'goal_achieved', 'competition_reminder', 'competition', 'performance') THEN 'performances'
    WHEN p_type IN ('weekly_report') THEN 'reports'
    WHEN p_type IN ('message') THEN 'messaging'
    WHEN p_type IN ('social_post', 'social') THEN 'social'
    WHEN p_type IN ('blessure', 'injury') THEN 'health'
    WHEN p_type IN ('wellness') THEN 'wellness'
    WHEN p_type IN ('charge', 'load', 'acwr') THEN 'training_load'
    WHEN p_type IN ('badge', 'achievement', 'gamification') THEN 'gamification'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.configure_module_athletes(text, integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.configure_module_athletes(text, integer[]) TO authenticated, service_role;

COMMIT;
