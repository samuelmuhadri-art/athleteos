BEGIN;

-- ---------------------------------------------------------------------------
-- Relations uniques. Les lignes strictement redondantes sont consolidees
-- avant la creation des index afin que la migration reste applicable sur une
-- base qui aurait deja subi un double clic ou un retry reseau.
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY competition_id, athlete_id
    ORDER BY (planned_event IS NOT NULL) DESC, id
  ) AS position
  FROM public.competition_athletes
)
DELETE FROM public.competition_athletes assignment
USING ranked duplicate
WHERE assignment.id = duplicate.id AND duplicate.position > 1;

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY session_id, athlete_id
    ORDER BY id
  ) AS position
  FROM public.session_athletes
)
DELETE FROM public.session_athletes assignment
USING ranked duplicate
WHERE assignment.id = duplicate.id AND duplicate.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS competition_athletes_competition_athlete_uidx
  ON public.competition_athletes (competition_id, athlete_id);
CREATE UNIQUE INDEX IF NOT EXISTS session_athletes_session_athlete_uidx
  ON public.session_athletes (session_id, athlete_id);

-- Une meme competition physique ne doit pas etre recreee par deux requetes
-- concurrentes. Les participants et resultats de doublons historiques sont
-- rattaches a la ligne la plus ancienne avant la suppression du doublon.
CREATE TEMP TABLE competition_merge_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY club_id, lower(btrim(name)), date,
        lower(btrim(coalesce(location, ''))), lower(btrim(coalesce(type, '')))
      ORDER BY id
    ) AS keeper_id,
    row_number() OVER (
      PARTITION BY club_id, lower(btrim(name)), date,
        lower(btrim(coalesce(location, ''))), lower(btrim(coalesce(type, '')))
      ORDER BY id
    ) AS position
  FROM public.competitions
  WHERE club_id IS NOT NULL AND name IS NOT NULL AND date IS NOT NULL
)
SELECT id AS duplicate_id, keeper_id
FROM ranked
WHERE position > 1;

INSERT INTO public.competition_athletes (competition_id, athlete_id, planned_event)
SELECT merge.keeper_id, assignment.athlete_id, assignment.planned_event
FROM public.competition_athletes assignment
JOIN competition_merge_map merge ON merge.duplicate_id = assignment.competition_id
ON CONFLICT (competition_id, athlete_id) DO UPDATE
SET planned_event = coalesce(public.competition_athletes.planned_event, excluded.planned_event);

UPDATE public.competition_results result
SET competition_id = merge.keeper_id
FROM competition_merge_map merge
WHERE result.competition_id = merge.duplicate_id;

UPDATE public.athlete_performances performance
SET competition_id = merge.keeper_id
FROM competition_merge_map merge
WHERE performance.competition_id = merge.duplicate_id;

DELETE FROM public.competitions competition
USING competition_merge_map merge
WHERE competition.id = merge.duplicate_id;

CREATE UNIQUE INDEX IF NOT EXISTS competitions_domain_uidx
  ON public.competitions (
    club_id,
    lower(btrim(name)),
    date,
    lower(btrim(coalesce(location, ''))),
    lower(btrim(coalesce(type, '')))
  )
  WHERE club_id IS NOT NULL AND name IS NOT NULL AND date IS NOT NULL;

-- Contraintes applicables aux nouvelles ecritures sans bloquer le deploiement
-- a cause d'une eventuelle ancienne ligne invalide.
DO $$ BEGIN
  ALTER TABLE public.session_athletes ADD CONSTRAINT session_athletes_rpe_range_check
    CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.sessions ADD CONSTRAINT sessions_time_format_check
    CHECK (time IS NULL OR time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.sessions ADD CONSTRAINT sessions_duration_range_check
    CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Le coach ne peut plus fabriquer une affectation vers un athlete d'un autre
-- club, meme en appelant directement PostgREST.
DROP POLICY IF EXISTS "session_athletes_coach_manage" ON public.session_athletes;
CREATE POLICY "session_athletes_coach_manage" ON public.session_athletes
  FOR ALL TO authenticated
  USING (
    public.get_my_role() IN ('head_coach', 'coach')
    AND EXISTS (
      SELECT 1 FROM public.sessions session
      WHERE session.id = session_athletes.session_id
        AND session.club_id = public.get_my_club_id()
    )
  )
  WITH CHECK (
    public.get_my_role() IN ('head_coach', 'coach')
    AND EXISTS (
      SELECT 1 FROM public.sessions session
      WHERE session.id = session_athletes.session_id
        AND session.club_id = public.get_my_club_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.athletes athlete
      WHERE athlete.id = session_athletes.athlete_id
        AND athlete.club_id = public.get_my_club_id()
    )
  );

DROP POLICY IF EXISTS "competition_results_coach_insert" ON public.competition_results;
CREATE POLICY "competition_results_coach_insert" ON public.competition_results
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() IN ('head_coach', 'coach')
    AND EXISTS (
      SELECT 1
      FROM public.competitions competition
      JOIN public.competition_athletes assignment
        ON assignment.competition_id = competition.id
       AND assignment.athlete_id = competition_results.athlete_id
      WHERE competition.id = competition_results.competition_id
        AND competition.club_id = public.get_my_club_id()
    )
  );

DROP POLICY IF EXISTS "competition_results_coach_update" ON public.competition_results;
CREATE POLICY "competition_results_coach_update" ON public.competition_results
  FOR UPDATE TO authenticated
  USING (
    public.get_my_role() IN ('head_coach', 'coach')
    AND public.can_view_competition(competition_id)
  )
  WITH CHECK (
    public.get_my_role() IN ('head_coach', 'coach')
    AND EXISTS (
      SELECT 1
      FROM public.competitions competition
      JOIN public.competition_athletes assignment
        ON assignment.competition_id = competition.id
       AND assignment.athlete_id = competition_results.athlete_id
      WHERE competition.id = competition_results.competition_id
        AND competition.club_id = public.get_my_club_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Competitions : idempotence serialisee, reutilisation de la meme competition
-- physique et verification de l'inscription avant tout resultat.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_competition_with_athletes(
  p_name text,
  p_date date,
  p_location text,
  p_type text,
  p_athlete_entries jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id integer;
  v_club_id integer;
  v_role text;
  v_my_athlete_id integer;
  v_cached jsonb;
  v_comp_id integer;
  v_entry jsonb;
  v_entry_count integer;
  v_result jsonb;
  v_reused boolean := false;
BEGIN
  SELECT id, club_id, role INTO v_caller_id, v_club_id, v_role
  FROM public.users
  WHERE lower(trim(auth_uid)) = lower(trim(auth.uid()::text))
  LIMIT 1;
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Profil introuvable.'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'create_competition_with_athletes:' || p_idempotency_key, 0
    ));
    SELECT result INTO v_cached
    FROM public.rpc_idempotency
    WHERE fn_name = 'create_competition_with_athletes'
      AND idempotency_key = p_idempotency_key
      AND actor_user_id = v_caller_id;
    IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  END IF;

  IF nullif(btrim(p_name), '') IS NULL THEN RAISE EXCEPTION 'Nom de competition manquant.'; END IF;
  IF p_date IS NULL THEN RAISE EXCEPTION 'Date manquante.'; END IF;
  IF jsonb_typeof(coalesce(p_athlete_entries, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Liste des athletes invalide.';
  END IF;

  v_entry_count := jsonb_array_length(coalesce(p_athlete_entries, '[]'::jsonb));
  IF v_entry_count = 0 THEN RAISE EXCEPTION 'Selectionne au moins un athlete.'; END IF;
  IF (
    SELECT count(DISTINCT (entry->>'athleteId')::integer)
    FROM jsonb_array_elements(p_athlete_entries) entry
  ) <> v_entry_count THEN
    RAISE EXCEPTION 'Un athlete ne peut etre inscrit qu une seule fois.';
  END IF;

  IF v_role NOT IN ('head_coach', 'coach') THEN
    SELECT id INTO v_my_athlete_id
    FROM public.athletes
    WHERE user_id = v_caller_id AND club_id = v_club_id
    LIMIT 1;
    IF v_my_athlete_id IS NULL OR v_entry_count <> 1
      OR (p_athlete_entries->0->>'athleteId')::integer <> v_my_athlete_id THEN
      RAISE EXCEPTION 'Un athlete ne peut creer une competition que pour lui-meme.';
    END IF;
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_athlete_entries) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.athletes
      WHERE id = (v_entry->>'athleteId')::integer AND club_id = v_club_id
    ) THEN
      RAISE EXCEPTION 'Un des athletes engages n est pas dans ton club.';
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    concat_ws(':', 'competition-domain', v_club_id, lower(btrim(p_name)), p_date,
      lower(btrim(coalesce(p_location, ''))), lower(btrim(coalesce(p_type, '')))), 0
  ));

  INSERT INTO public.competitions (club_id, name, date, location, type)
  VALUES (v_club_id, btrim(p_name), p_date,
    nullif(btrim(coalesce(p_location, '')), ''), p_type)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_comp_id;

  IF v_comp_id IS NULL THEN
    v_reused := true;
    SELECT id INTO v_comp_id
    FROM public.competitions
    WHERE club_id = v_club_id
      AND lower(btrim(name)) = lower(btrim(p_name))
      AND date = p_date
      AND lower(btrim(coalesce(location, ''))) = lower(btrim(coalesce(p_location, '')))
      AND lower(btrim(coalesce(type, ''))) = lower(btrim(coalesce(p_type, '')))
    ORDER BY id
    LIMIT 1;
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_athlete_entries) LOOP
    INSERT INTO public.competition_athletes (competition_id, athlete_id, planned_event)
    VALUES (v_comp_id, (v_entry->>'athleteId')::integer,
      nullif(btrim(coalesce(v_entry->>'plannedEvent', '')), ''))
    ON CONFLICT (competition_id, athlete_id) DO UPDATE
    SET planned_event = coalesce(excluded.planned_event, public.competition_athletes.planned_event);
  END LOOP;

  v_result := jsonb_build_object(
    'competitionId', v_comp_id,
    'athleteCount', v_entry_count,
    'reused', v_reused
  );
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (fn_name, idempotency_key, actor_user_id, result)
    VALUES ('create_competition_with_athletes', p_idempotency_key, v_caller_id, v_result)
    ON CONFLICT (fn_name, idempotency_key) DO NOTHING;
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_competition_result(
  p_competition_id integer,
  p_athlete_id integer,
  p_event text,
  p_result text,
  p_result_value numeric,
  p_higher_is_better boolean,
  p_context text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_unit text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id integer;
  v_club_id integer;
  v_role text;
  v_cached jsonb;
  v_comp record;
  v_athlete record;
  v_result jsonb;
BEGIN
  SELECT id, club_id, role INTO v_caller_id, v_club_id, v_role
  FROM public.users
  WHERE lower(trim(auth_uid)) = lower(trim(auth.uid()::text))
  LIMIT 1;
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Profil introuvable.'; END IF;
  IF v_role NOT IN ('head_coach', 'coach') THEN RAISE EXCEPTION 'Action reservee au coach.'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'add_competition_result:' || p_idempotency_key, 0
    ));
    SELECT result INTO v_cached
    FROM public.rpc_idempotency
    WHERE fn_name = 'add_competition_result'
      AND idempotency_key = p_idempotency_key
      AND actor_user_id = v_caller_id;
    IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  END IF;

  IF nullif(btrim(p_event), '') IS NULL THEN RAISE EXCEPTION 'Discipline manquante.'; END IF;
  IF nullif(btrim(p_result), '') IS NULL OR p_result_value IS NULL THEN
    RAISE EXCEPTION 'Resultat non interpretable.';
  END IF;

  SELECT id, name, date, club_id INTO v_comp
  FROM public.competitions WHERE id = p_competition_id;
  IF v_comp.id IS NULL OR v_comp.club_id <> v_club_id THEN
    RAISE EXCEPTION 'Competition introuvable dans ton club.';
  END IF;
  SELECT id, name, club_id INTO v_athlete
  FROM public.athletes WHERE id = p_athlete_id;
  IF v_athlete.id IS NULL OR v_athlete.club_id <> v_club_id THEN
    RAISE EXCEPTION 'Athlete introuvable dans ton club.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.competition_athletes
    WHERE competition_id = p_competition_id AND athlete_id = p_athlete_id
  ) THEN
    RAISE EXCEPTION 'Cet athlete n est pas inscrit a cette competition.';
  END IF;

  v_result := public._apply_competition_result(
    p_competition_id, p_athlete_id, v_club_id, v_athlete.name,
    p_event, p_result, p_result_value, p_higher_is_better, p_context,
    v_comp.name, false, v_comp.date, NULL, p_unit
  );
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (fn_name, idempotency_key, actor_user_id, result)
    VALUES ('add_competition_result', p_idempotency_key, v_caller_id, v_result)
    ON CONFLICT (fn_name, idempotency_key) DO NOTHING;
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_solo_competition_result(
  p_name text,
  p_date date,
  p_location text,
  p_type text,
  p_event text,
  p_result text,
  p_result_value numeric,
  p_higher_is_better boolean,
  p_context text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_breakdown jsonb DEFAULT NULL,
  p_unit text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id integer;
  v_club_id integer;
  v_my_athlete_id integer;
  v_my_name text;
  v_cached jsonb;
  v_comp_id integer;
  v_result jsonb;
BEGIN
  SELECT id, club_id INTO v_caller_id, v_club_id
  FROM public.users
  WHERE lower(trim(auth_uid)) = lower(trim(auth.uid()::text))
  LIMIT 1;
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Profil introuvable.'; END IF;
  SELECT id, name INTO v_my_athlete_id, v_my_name
  FROM public.athletes
  WHERE user_id = v_caller_id AND club_id = v_club_id
  LIMIT 1;
  IF v_my_athlete_id IS NULL THEN RAISE EXCEPTION 'Profil athlete introuvable.'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'create_solo_competition_result:' || p_idempotency_key, 0
    ));
    SELECT result INTO v_cached
    FROM public.rpc_idempotency
    WHERE fn_name = 'create_solo_competition_result'
      AND idempotency_key = p_idempotency_key
      AND actor_user_id = v_caller_id;
    IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  END IF;

  IF nullif(btrim(p_name), '') IS NULL OR p_date IS NULL THEN
    RAISE EXCEPTION 'Nom ou date de competition manquant.';
  END IF;
  IF nullif(btrim(p_event), '') IS NULL OR nullif(btrim(p_result), '') IS NULL
    OR p_result_value IS NULL THEN
    RAISE EXCEPTION 'Resultat non interpretable.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    concat_ws(':', 'competition-domain', v_club_id, lower(btrim(p_name)), p_date,
      lower(btrim(coalesce(p_location, ''))), lower(btrim(coalesce(p_type, '')))), 0
  ));
  INSERT INTO public.competitions (club_id, name, date, location, type)
  VALUES (v_club_id, btrim(p_name), p_date,
    nullif(btrim(coalesce(p_location, '')), ''), p_type)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_comp_id;
  IF v_comp_id IS NULL THEN
    SELECT id INTO v_comp_id
    FROM public.competitions
    WHERE club_id = v_club_id
      AND lower(btrim(name)) = lower(btrim(p_name))
      AND date = p_date
      AND lower(btrim(coalesce(location, ''))) = lower(btrim(coalesce(p_location, '')))
      AND lower(btrim(coalesce(type, ''))) = lower(btrim(coalesce(p_type, '')))
    ORDER BY id LIMIT 1;
  END IF;

  INSERT INTO public.competition_athletes (competition_id, athlete_id, planned_event)
  VALUES (v_comp_id, v_my_athlete_id, p_event)
  ON CONFLICT (competition_id, athlete_id) DO UPDATE
  SET planned_event = excluded.planned_event;

  v_result := public._apply_competition_result(
    v_comp_id, v_my_athlete_id, v_club_id, v_my_name, p_event, p_result,
    p_result_value, p_higher_is_better, p_context, btrim(p_name), true,
    p_date, p_breakdown, p_unit
  );
  UPDATE public.athlete_performances
  SET competition_id = v_comp_id
  WHERE id = (v_result->>'performanceId')::bigint
    AND athlete_id = v_my_athlete_id;
  v_result := v_result || jsonb_build_object('competitionId', v_comp_id);

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (fn_name, idempotency_key, actor_user_id, result)
    VALUES ('create_solo_competition_result', p_idempotency_key, v_caller_id, v_result)
    ON CONFLICT (fn_name, idempotency_key) DO NOTHING;
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_competition_with_athletes(text, date, text, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_competition_result(integer, integer, text, text, numeric, boolean, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_solo_competition_result(text, date, text, text, text, text, numeric, boolean, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_competition_with_athletes(text, date, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_competition_result(integer, integer, text, text, numeric, boolean, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_solo_competition_result(text, date, text, text, text, text, numeric, boolean, text, text, jsonb, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Planning transactionnel avec controle des affectations et chevauchements.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._assert_session_write(
  p_session jsonb,
  p_athlete_ids integer[],
  p_excluded_session_id integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_club_id integer := public.get_my_club_id();
  v_date date;
  v_time time;
  v_duration integer;
BEGIN
  IF nullif(btrim(p_session->>'title'), '') IS NULL THEN RAISE EXCEPTION 'Titre manquant.'; END IF;
  v_date := nullif(p_session->>'sessionDate', '')::date;
  IF v_date IS NULL THEN RAISE EXCEPTION 'Date manquante.'; END IF;
  IF coalesce(p_session->>'time', '') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'Heure invalide.';
  END IF;
  v_time := (p_session->>'time')::time;
  v_duration := nullif(p_session->>'durationMinutes', '')::integer;
  IF v_duration IS NULL OR v_duration NOT BETWEEN 1 AND 1440 THEN
    RAISE EXCEPTION 'Duree invalide.';
  END IF;
  IF cardinality(coalesce(p_athlete_ids, ARRAY[]::integer[])) = 0 THEN
    RAISE EXCEPTION 'Selectionne au moins un athlete.';
  END IF;
  IF (
    SELECT count(DISTINCT athlete_id)
    FROM unnest(p_athlete_ids) athlete_id
  ) <> cardinality(p_athlete_ids) THEN
    RAISE EXCEPTION 'Un athlete ne peut etre assigne qu une seule fois.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_athlete_ids) selected_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.athletes athlete
      WHERE athlete.id = selected_id AND athlete.club_id = v_club_id
    )
  ) THEN
    RAISE EXCEPTION 'Un athlete selectionne n appartient pas au club.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.session_athletes assignment
    JOIN public.sessions existing ON existing.id = assignment.session_id
    WHERE assignment.athlete_id = ANY(p_athlete_ids)
      AND existing.club_id = v_club_id
      AND existing.session_date = v_date
      AND existing.id IS DISTINCT FROM p_excluded_session_id
      AND existing.time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
      AND existing.duration_minutes BETWEEN 1 AND 1440
      AND (
        existing.session_date + existing.time::time,
        existing.session_date + existing.time::time + make_interval(mins => existing.duration_minutes)
      ) OVERLAPS (
        v_date + v_time,
        v_date + v_time + make_interval(mins => v_duration)
      )
  ) THEN
    RAISE EXCEPTION 'Cette seance chevauche deja une seance d un athlete selectionne.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_session_with_athletes(
  p_session jsonb,
  p_athlete_ids integer[],
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id integer := public.get_my_user_id();
  v_club_id integer := public.get_my_club_id();
  v_role text := public.get_my_role();
  v_my_athlete_id integer := public.get_my_athlete_id();
  v_cached jsonb;
  v_session_id integer;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL OR v_role NOT IN ('head_coach', 'coach', 'athlete') THEN
    RAISE EXCEPTION 'Action non autorisee.';
  END IF;
  IF v_role = 'athlete' AND NOT (v_my_athlete_id = ANY(p_athlete_ids)) THEN
    RAISE EXCEPTION 'Ta propre affectation est obligatoire.';
  END IF;
  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('create_session_with_athletes:' || p_idempotency_key, 0));
    SELECT result INTO v_cached FROM public.rpc_idempotency
    WHERE fn_name = 'create_session_with_athletes'
      AND idempotency_key = p_idempotency_key AND actor_user_id = v_user_id;
    IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  END IF;
  PERFORM public._assert_session_write(p_session, p_athlete_ids, NULL);

  INSERT INTO public.sessions (
    club_id, week, day, session_date, time, type, category, title,
    training_focus, description, instructions, duration_minutes,
    load_weight, pdf_url, created_by
  ) VALUES (
    v_club_id, nullif(p_session->>'week', '')::integer,
    nullif(p_session->>'day', ''), (p_session->>'sessionDate')::date,
    p_session->>'time', nullif(p_session->>'type', ''),
    nullif(p_session->>'category', ''), btrim(p_session->>'title'),
    nullif(p_session->>'trainingFocus', ''), nullif(p_session->>'description', ''),
    nullif(p_session->>'instructions', ''), (p_session->>'durationMinutes')::integer,
    coalesce(nullif(p_session->>'loadWeight', '')::numeric, 1.0),
    nullif(p_session->>'pdfUrl', ''), v_user_id
  ) RETURNING id INTO v_session_id;

  INSERT INTO public.session_athletes (session_id, athlete_id, status)
  SELECT v_session_id, athlete_id, NULL
  FROM unnest(p_athlete_ids) athlete_id;

  v_result := jsonb_build_object('sessionId', v_session_id);
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (fn_name, idempotency_key, actor_user_id, result)
    VALUES ('create_session_with_athletes', p_idempotency_key, v_user_id, v_result)
    ON CONFLICT (fn_name, idempotency_key) DO NOTHING;
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_session_with_athletes(
  p_session_id integer,
  p_session jsonb,
  p_athlete_ids integer[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id integer := public.get_my_user_id();
  v_club_id integer := public.get_my_club_id();
  v_role text := public.get_my_role();
  v_existing public.sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_existing FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_existing.club_id <> v_club_id THEN RAISE EXCEPTION 'Seance introuvable.'; END IF;
  IF v_role NOT IN ('head_coach', 'coach')
    AND NOT (v_role = 'athlete' AND v_existing.created_by = v_user_id) THEN
    RAISE EXCEPTION 'Action non autorisee.';
  END IF;
  IF v_role = 'athlete' AND NOT (public.get_my_athlete_id() = ANY(p_athlete_ids)) THEN
    RAISE EXCEPTION 'Ta propre affectation est obligatoire.';
  END IF;
  PERFORM public._assert_session_write(p_session, p_athlete_ids, p_session_id);

  UPDATE public.sessions SET
    week = nullif(p_session->>'week', '')::integer,
    day = nullif(p_session->>'day', ''),
    session_date = (p_session->>'sessionDate')::date,
    time = p_session->>'time',
    type = nullif(p_session->>'type', ''),
    category = nullif(p_session->>'category', ''),
    title = btrim(p_session->>'title'),
    training_focus = nullif(p_session->>'trainingFocus', ''),
    description = nullif(p_session->>'description', ''),
    instructions = nullif(p_session->>'instructions', ''),
    duration_minutes = (p_session->>'durationMinutes')::integer,
    load_weight = coalesce(nullif(p_session->>'loadWeight', '')::numeric, load_weight),
    pdf_url = CASE WHEN p_session ? 'pdfUrl' THEN nullif(p_session->>'pdfUrl', '') ELSE pdf_url END
  WHERE id = p_session_id;

  DELETE FROM public.session_athletes
  WHERE session_id = p_session_id AND NOT (athlete_id = ANY(p_athlete_ids));
  INSERT INTO public.session_athletes (session_id, athlete_id, status)
  SELECT p_session_id, athlete_id, NULL FROM unnest(p_athlete_ids) athlete_id
  ON CONFLICT (session_id, athlete_id) DO NOTHING;

  RETURN jsonb_build_object('sessionId', p_session_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_session_transactional(p_session_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id integer := public.get_my_user_id();
  v_club_id integer := public.get_my_club_id();
  v_role text := public.get_my_role();
  v_existing public.sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_existing FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_existing.club_id <> v_club_id THEN RAISE EXCEPTION 'Seance introuvable.'; END IF;
  IF v_role NOT IN ('head_coach', 'coach')
    AND NOT (v_role = 'athlete' AND v_existing.created_by = v_user_id) THEN
    RAISE EXCEPTION 'Action non autorisee.';
  END IF;
  DELETE FROM public.sessions WHERE id = p_session_id;
  RETURN jsonb_build_object('sessionId', p_session_id, 'pdfPath', v_existing.pdf_url);
END;
$$;

REVOKE ALL ON FUNCTION public._assert_session_write(jsonb, integer[], integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_session_with_athletes(jsonb, integer[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_session_with_athletes(integer, jsonb, integer[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_session_transactional(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_session_with_athletes(jsonb, integer[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_with_athletes(integer, jsonb, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_session_transactional(integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Suppression de performance avec recalcul atomique PR/SB.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_athlete_performance(p_performance_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id integer := public.get_my_user_id();
  v_role text := public.get_my_role();
  v_club_id integer := public.get_my_club_id();
  v_deleted public.athlete_performances%ROWTYPE;
  v_record public.records%ROWTYPE;
  v_direction text;
  v_best record;
  v_season record;
BEGIN
  SELECT * INTO v_deleted
  FROM public.athlete_performances
  WHERE id = p_performance_id
  FOR UPDATE;
  IF NOT FOUND OR v_deleted.club_id <> v_club_id THEN RAISE EXCEPTION 'Performance introuvable.'; END IF;
  IF v_role = 'athlete' AND v_deleted.athlete_id <> public.get_my_athlete_id() THEN
    RAISE EXCEPTION 'Action non autorisee.';
  END IF;
  IF v_role NOT IN ('head_coach', 'coach', 'athlete') THEN RAISE EXCEPTION 'Action non autorisee.'; END IF;

  SELECT * INTO v_record FROM public.records
  WHERE athlete_id = v_deleted.athlete_id AND discipline = v_deleted.discipline
  FOR UPDATE;
  v_direction := coalesce(v_deleted.performance_direction, v_record.performance_direction, 'higher');
  DELETE FROM public.athlete_performances WHERE id = p_performance_id;

  SELECT source.value, source.normalized_value, source.performance_date, source.unit
  INTO v_best
  FROM (
    SELECT performance.value, performance.normalized_value, performance.performance_date, performance.unit
    FROM public.athlete_performances performance
    WHERE performance.athlete_id = v_deleted.athlete_id
      AND performance.discipline = v_deleted.discipline
      AND performance.normalized_value IS NOT NULL
    UNION ALL
    SELECT result.result, result.result_value, competition.date, result.unit
    FROM public.competition_results result
    JOIN public.competitions competition ON competition.id = result.competition_id
    WHERE result.athlete_id = v_deleted.athlete_id
      AND result.event = v_deleted.discipline
      AND result.result_value IS NOT NULL
  ) source
  ORDER BY CASE WHEN v_direction = 'lower' THEN source.normalized_value END ASC NULLS LAST,
           CASE WHEN v_direction = 'higher' THEN source.normalized_value END DESC NULLS LAST,
           source.performance_date ASC
  LIMIT 1;

  SELECT source.value, source.normalized_value, source.performance_date, source.unit
  INTO v_season
  FROM (
    SELECT performance.value, performance.normalized_value, performance.performance_date, performance.unit
    FROM public.athlete_performances performance
    WHERE performance.athlete_id = v_deleted.athlete_id
      AND performance.discipline = v_deleted.discipline
      AND performance.normalized_value IS NOT NULL
      AND extract(year FROM performance.performance_date) = extract(year FROM current_date)
    UNION ALL
    SELECT result.result, result.result_value, competition.date, result.unit
    FROM public.competition_results result
    JOIN public.competitions competition ON competition.id = result.competition_id
    WHERE result.athlete_id = v_deleted.athlete_id
      AND result.event = v_deleted.discipline
      AND result.result_value IS NOT NULL
      AND extract(year FROM competition.date) = extract(year FROM current_date)
  ) source
  ORDER BY CASE WHEN v_direction = 'lower' THEN source.normalized_value END ASC NULLS LAST,
           CASE WHEN v_direction = 'higher' THEN source.normalized_value END DESC NULLS LAST,
           source.performance_date ASC
  LIMIT 1;

  IF v_record.id IS NOT NULL AND (
    v_record.pr_value IS NOT DISTINCT FROM v_deleted.normalized_value
    OR v_record.sb_value IS NOT DISTINCT FROM v_deleted.normalized_value
  ) THEN
    UPDATE public.records SET
      pr = v_best.value,
      pr_value = v_best.normalized_value,
      pr_date = v_best.performance_date,
      sb = v_season.value,
      sb_value = v_season.normalized_value,
      unit = coalesce(v_best.unit, v_season.unit, unit)
    WHERE id = v_record.id;
  END IF;
  RETURN jsonb_build_object('performanceId', p_performance_id, 'recordRecalculated', v_record.id IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_athlete_performance(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_athlete_performance(bigint) TO authenticated;

-- ---------------------------------------------------------------------------
-- Profils athletes : creation/mise a jour atomiques et synchronisation du nom
-- de la ligne users associee.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_club_athlete(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_club_id integer := public.get_my_club_id();
  v_role text := public.get_my_role();
  v_name text := nullif(btrim(p_payload->>'name'), '');
  v_email text := nullif(lower(btrim(p_payload->>'email')), '');
  v_user_id integer;
  v_athlete_id integer;
BEGIN
  IF v_role NOT IN ('head_coach', 'coach') THEN RAISE EXCEPTION 'Action reservee au coach.'; END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Nom manquant.'; END IF;
  IF v_email IS NOT NULL THEN
    INSERT INTO public.users (club_id, name, email, role)
    VALUES (v_club_id, v_name, v_email, 'athlete')
    RETURNING id INTO v_user_id;
  END IF;
  INSERT INTO public.athletes (
    club_id, name, age, main_discipline, group_name, user_id, profile_data
  ) VALUES (
    v_club_id, v_name, nullif(p_payload->>'age', '')::integer,
    nullif(p_payload->>'mainDiscipline', ''), nullif(p_payload->>'groupName', ''),
    v_user_id, coalesce(p_payload->'profileData', '{}'::jsonb)
  ) RETURNING id INTO v_athlete_id;
  RETURN jsonb_build_object('athleteId', v_athlete_id, 'userId', v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_club_athlete(p_athlete_id integer, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_club_id integer := public.get_my_club_id();
  v_role text := public.get_my_role();
  v_name text := nullif(btrim(p_payload->>'name'), '');
  v_user_id integer;
BEGIN
  IF v_role NOT IN ('head_coach', 'coach') THEN RAISE EXCEPTION 'Action reservee au coach.'; END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Nom manquant.'; END IF;
  SELECT user_id INTO v_user_id FROM public.athletes
  WHERE id = p_athlete_id AND club_id = v_club_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Athlete introuvable.'; END IF;
  UPDATE public.athletes SET
    name = v_name,
    age = nullif(p_payload->>'age', '')::integer,
    main_discipline = nullif(p_payload->>'mainDiscipline', ''),
    group_name = nullif(p_payload->>'groupName', ''),
    profile_data = coalesce(p_payload->'profileData', '{}'::jsonb)
  WHERE id = p_athlete_id;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.users SET name = v_name WHERE id = v_user_id AND club_id = v_club_id;
  END IF;
  RETURN jsonb_build_object('athleteId', p_athlete_id, 'userId', v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_unlinked_club_athlete(p_athlete_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_club_id integer := public.get_my_club_id();
  v_role text := public.get_my_role();
  v_user_id integer;
BEGIN
  IF v_role NOT IN ('head_coach', 'coach') THEN RAISE EXCEPTION 'Action reservee au coach.'; END IF;
  SELECT user_id INTO v_user_id FROM public.athletes
  WHERE id = p_athlete_id AND club_id = v_club_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Athlete introuvable.'; END IF;
  IF v_user_id IS NOT NULL THEN RAISE EXCEPTION 'linked_account_requires_admin'; END IF;
  DELETE FROM public.athletes WHERE id = p_athlete_id;
  RETURN jsonb_build_object('athleteId', p_athlete_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_club_athlete(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_club_athlete(integer, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_unlinked_club_athlete(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_club_athlete(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_club_athlete(integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_unlinked_club_athlete(integer) TO authenticated;

COMMIT;
