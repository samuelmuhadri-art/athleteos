BEGIN;

-- AthleteOS Performance Metadata v1. Ces colonnes sont additives : les
-- anciennes lignes restent lisibles et sont marquées "unknown" lorsqu'une
-- condition de compétition ne peut pas être reconstruite honnêtement.
ALTER TABLE public.athlete_performances
  ADD COLUMN measurement_type text,
  ADD COLUMN performance_direction text,
  ADD COLUMN venue_type text NOT NULL DEFAULT 'unknown',
  ADD COLUMN wind_mps numeric,
  ADD COLUMN timing_method text NOT NULL DEFAULT 'unknown',
  ADD COLUMN implement_weight_kg numeric,
  ADD COLUMN hurdle_height_m numeric,
  ADD COLUMN official_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN scoring_table_version text,
  ADD COLUMN metadata_version text NOT NULL DEFAULT 'athleteos-performance-v1';

ALTER TABLE public.competition_results
  ADD COLUMN measurement_type text,
  ADD COLUMN performance_direction text,
  ADD COLUMN venue_type text NOT NULL DEFAULT 'unknown',
  ADD COLUMN wind_mps numeric,
  ADD COLUMN timing_method text NOT NULL DEFAULT 'unknown',
  ADD COLUMN implement_weight_kg numeric,
  ADD COLUMN hurdle_height_m numeric,
  ADD COLUMN official_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN scoring_table_version text,
  ADD COLUMN metadata_version text NOT NULL DEFAULT 'athleteos-performance-v1';

ALTER TABLE public.records
  ADD COLUMN measurement_type text,
  ADD COLUMN performance_direction text,
  ADD COLUMN metadata_version text NOT NULL DEFAULT 'athleteos-performance-v1';

-- Le catalogue officiel utilise s/m/pts, mais une épreuve club explicite
-- peut avoir une autre unité courte. On interdit seulement le vide et les
-- chaînes déraisonnablement longues au lieu de la réinterpréter en chrono.
ALTER TABLE public.athlete_performances DROP CONSTRAINT athlete_performances_unit_check;
ALTER TABLE public.competition_results DROP CONSTRAINT competition_results_unit_check;
ALTER TABLE public.records DROP CONSTRAINT records_unit_check;
ALTER TABLE public.athlete_performances ADD CONSTRAINT athlete_performances_unit_check CHECK (unit IS NULL OR char_length(btrim(unit)) BETWEEN 1 AND 16);
ALTER TABLE public.competition_results ADD CONSTRAINT competition_results_unit_check CHECK (unit IS NULL OR char_length(btrim(unit)) BETWEEN 1 AND 16);
ALTER TABLE public.records ADD CONSTRAINT records_unit_check CHECK (unit IS NULL OR char_length(btrim(unit)) BETWEEN 1 AND 16);

ALTER TABLE public.athlete_performances
  ADD CONSTRAINT athlete_performances_measurement_type_check CHECK (measurement_type IS NULL OR measurement_type IN ('time', 'distance', 'points', 'unknown')),
  ADD CONSTRAINT athlete_performances_direction_check CHECK (performance_direction IS NULL OR performance_direction IN ('lower', 'higher', 'unknown')),
  ADD CONSTRAINT athlete_performances_venue_check CHECK (venue_type IN ('indoor', 'outdoor', 'road', 'unknown')),
  ADD CONSTRAINT athlete_performances_timing_check CHECK (timing_method IN ('fully_automatic', 'hand', 'transponder', 'unknown', 'not_applicable')),
  ADD CONSTRAINT athlete_performances_official_check CHECK (official_status IN ('official', 'unofficial', 'unknown')),
  ADD CONSTRAINT athlete_performances_wind_check CHECK (wind_mps IS NULL OR wind_mps BETWEEN -20 AND 20),
  ADD CONSTRAINT athlete_performances_implement_check CHECK (implement_weight_kg IS NULL OR implement_weight_kg > 0),
  ADD CONSTRAINT athlete_performances_hurdle_check CHECK (hurdle_height_m IS NULL OR hurdle_height_m > 0);

ALTER TABLE public.competition_results
  ADD CONSTRAINT competition_results_measurement_type_check CHECK (measurement_type IS NULL OR measurement_type IN ('time', 'distance', 'points', 'unknown')),
  ADD CONSTRAINT competition_results_direction_check CHECK (performance_direction IS NULL OR performance_direction IN ('lower', 'higher', 'unknown')),
  ADD CONSTRAINT competition_results_venue_check CHECK (venue_type IN ('indoor', 'outdoor', 'road', 'unknown')),
  ADD CONSTRAINT competition_results_timing_check CHECK (timing_method IN ('fully_automatic', 'hand', 'transponder', 'unknown', 'not_applicable')),
  ADD CONSTRAINT competition_results_official_check CHECK (official_status IN ('official', 'unofficial', 'unknown')),
  ADD CONSTRAINT competition_results_wind_check CHECK (wind_mps IS NULL OR wind_mps BETWEEN -20 AND 20),
  ADD CONSTRAINT competition_results_implement_check CHECK (implement_weight_kg IS NULL OR implement_weight_kg > 0),
  ADD CONSTRAINT competition_results_hurdle_check CHECK (hurdle_height_m IS NULL OR hurdle_height_m > 0);

ALTER TABLE public.records
  ADD CONSTRAINT records_measurement_type_check CHECK (measurement_type IS NULL OR measurement_type IN ('time', 'distance', 'points', 'unknown')),
  ADD CONSTRAINT records_direction_check CHECK (performance_direction IS NULL OR performance_direction IN ('lower', 'higher', 'unknown'));

-- Backfill prudent fondé sur l'unité déjà normalisée. Aucune unité absente
-- n'est inventée et aucune ancienne valeur libre n'est supposée être un temps.
UPDATE public.athlete_performances SET
  measurement_type = CASE WHEN unit = 's' THEN 'time' WHEN unit = 'm' THEN 'distance' WHEN unit = 'pts' THEN 'points' ELSE 'unknown' END,
  performance_direction = CASE WHEN unit = 's' THEN 'lower' WHEN unit IN ('m', 'pts') THEN 'higher' ELSE 'unknown' END,
  timing_method = CASE WHEN unit = 's' THEN 'unknown' ELSE 'not_applicable' END;

UPDATE public.competition_results SET
  measurement_type = CASE WHEN unit = 's' THEN 'time' WHEN unit = 'm' THEN 'distance' WHEN unit = 'pts' THEN 'points' ELSE 'unknown' END,
  performance_direction = CASE WHEN unit = 's' THEN 'lower' WHEN unit IN ('m', 'pts') THEN 'higher' ELSE 'unknown' END,
  timing_method = CASE WHEN unit = 's' THEN 'unknown' ELSE 'not_applicable' END;

UPDATE public.records SET
  measurement_type = CASE WHEN unit = 's' THEN 'time' WHEN unit = 'm' THEN 'distance' WHEN unit = 'pts' THEN 'points' ELSE 'unknown' END,
  performance_direction = CASE WHEN unit = 's' THEN 'lower' WHEN unit IN ('m', 'pts') THEN 'higher' ELSE 'unknown' END;

CREATE OR REPLACE FUNCTION public.add_athlete_performance(
  p_discipline text,
  p_value text,
  p_result_value numeric,
  p_performance_date date,
  p_context text DEFAULT NULL,
  p_breakdown jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id integer;
  v_club_id integer;
  v_athlete_id integer;
  v_cached jsonb;
  v_performance_id bigint;
  v_record_id integer;
  v_existing_pr numeric;
  v_existing_sb numeric;
  v_is_pr boolean := false;
  v_is_sb boolean := false;
  v_this_year boolean;
  v_direction text := coalesce(nullif(p_metadata->>'performance_direction', ''), 'unknown');
  v_unit text := nullif(p_metadata->>'unit', '');
  v_measurement text := coalesce(nullif(p_metadata->>'measurement_type', ''), 'unknown');
  v_result jsonb;
BEGIN
  SELECT id, club_id INTO v_user_id, v_club_id FROM public.users
  WHERE lower(trim(auth_uid)) = lower(trim(auth.uid()::text)) LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Profil introuvable.'; END IF;
  SELECT id INTO v_athlete_id FROM public.athletes WHERE user_id = v_user_id AND club_id = v_club_id LIMIT 1;
  IF v_athlete_id IS NULL THEN RAISE EXCEPTION 'Profil athlète introuvable.'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT result INTO v_cached FROM public.rpc_idempotency
    WHERE fn_name = 'add_athlete_performance' AND idempotency_key = p_idempotency_key AND actor_user_id = v_user_id;
    IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  END IF;

  IF nullif(btrim(p_discipline), '') IS NULL THEN RAISE EXCEPTION 'Discipline manquante.'; END IF;
  IF nullif(btrim(p_value), '') IS NULL OR p_result_value IS NULL THEN RAISE EXCEPTION 'Résultat non interprétable.'; END IF;
  IF p_performance_date IS NULL THEN RAISE EXCEPTION 'Date manquante.'; END IF;
  IF v_direction NOT IN ('lower', 'higher') THEN RAISE EXCEPTION 'Sens de performance à préciser.'; END IF;
  IF v_measurement NOT IN ('time', 'distance', 'points') THEN RAISE EXCEPTION 'Type de mesure à préciser.'; END IF;
  IF v_unit IS NULL THEN RAISE EXCEPTION 'Unité de performance à préciser.'; END IF;

  INSERT INTO public.athlete_performances (
    athlete_id, club_id, discipline, discipline_type, value, performance_date,
    context, breakdown, normalized_value, unit, discipline_id, quality_flags,
    measurement_type, performance_direction, venue_type, wind_mps, timing_method,
    implement_weight_kg, hurdle_height_m, official_status, scoring_table_version, metadata_version
  ) VALUES (
    v_athlete_id, v_club_id, p_discipline, p_discipline, p_value, p_performance_date,
    nullif(p_context, ''), p_breakdown, p_result_value, v_unit, p_discipline, '{}',
    v_measurement, v_direction, coalesce(p_metadata->>'venue_type', 'unknown'),
    nullif(p_metadata->>'wind_mps', '')::numeric, coalesce(p_metadata->>'timing_method', 'unknown'),
    nullif(p_metadata->>'implement_weight_kg', '')::numeric, nullif(p_metadata->>'hurdle_height_m', '')::numeric,
    coalesce(p_metadata->>'official_status', 'unknown'), nullif(p_metadata->>'scoring_table_version', ''),
    coalesce(p_metadata->>'metadata_version', 'athleteos-performance-v1')
  ) RETURNING id INTO v_performance_id;

  v_this_year := date_part('year', p_performance_date) = date_part('year', now());
  INSERT INTO public.records (athlete_id, discipline, pr, pr_value, pr_date, sb, sb_value, unit, discipline_id, measurement_type, performance_direction)
  VALUES (v_athlete_id, p_discipline, p_value, p_result_value, p_performance_date,
    CASE WHEN v_this_year THEN p_value END, CASE WHEN v_this_year THEN p_result_value END,
    v_unit, p_discipline, v_measurement, v_direction)
  ON CONFLICT (athlete_id, discipline) DO NOTHING RETURNING id INTO v_record_id;

  IF v_record_id IS NOT NULL THEN
    v_is_pr := true;
    v_is_sb := v_this_year;
  ELSE
    SELECT id, pr_value, sb_value INTO v_record_id, v_existing_pr, v_existing_sb
    FROM public.records WHERE athlete_id = v_athlete_id AND discipline = p_discipline FOR UPDATE;
    v_is_pr := v_existing_pr IS NULL OR (v_direction = 'higher' AND p_result_value > v_existing_pr) OR (v_direction = 'lower' AND p_result_value < v_existing_pr);
    v_is_sb := v_this_year AND (v_existing_sb IS NULL OR (v_direction = 'higher' AND p_result_value > v_existing_sb) OR (v_direction = 'lower' AND p_result_value < v_existing_sb));
    UPDATE public.records SET
      pr = CASE WHEN v_is_pr THEN p_value ELSE pr END,
      pr_value = CASE WHEN v_is_pr THEN p_result_value ELSE pr_value END,
      pr_date = CASE WHEN v_is_pr THEN p_performance_date ELSE pr_date END,
      sb = CASE WHEN v_is_sb THEN p_value ELSE sb END,
      sb_value = CASE WHEN v_is_sb THEN p_result_value ELSE sb_value END,
      unit = v_unit, discipline_id = p_discipline,
      measurement_type = v_measurement, performance_direction = v_direction
    WHERE id = v_record_id;
  END IF;

  v_result := jsonb_build_object('performanceId', v_performance_id, 'recordId', v_record_id, 'isNewRecord', v_is_pr, 'isNewSeasonBest', v_is_sb);
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (fn_name, idempotency_key, actor_user_id, result)
    VALUES ('add_athlete_performance', p_idempotency_key, v_user_id, v_result)
    ON CONFLICT (fn_name, idempotency_key) DO NOTHING;
  END IF;
  RETURN v_result;
END;
$$;

-- V2 enveloppe les RPC de compétition existantes : même transaction, aucun
-- retrait de compatibilité, et contexte structuré ajouté après leur écriture.
CREATE OR REPLACE FUNCTION public.add_competition_result_v2(
  p_competition_id integer, p_athlete_id integer, p_event text, p_result text,
  p_result_value numeric, p_higher_is_better boolean, p_context text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL, p_unit text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_result jsonb;
BEGIN
  IF coalesce(p_metadata->>'measurement_type', 'unknown') NOT IN ('time', 'distance', 'points')
    OR coalesce(p_metadata->>'performance_direction', 'unknown') NOT IN ('lower', 'higher')
    OR nullif(coalesce(p_unit, p_metadata->>'unit'), '') IS NULL
  THEN RAISE EXCEPTION 'Métadonnées de performance incomplètes.'; END IF;
  IF (p_metadata->>'performance_direction' = 'higher') IS DISTINCT FROM p_higher_is_better
  THEN RAISE EXCEPTION 'Sens de comparaison incohérent.'; END IF;
  v_result := public.add_competition_result(p_competition_id, p_athlete_id, p_event, p_result, p_result_value, p_higher_is_better, p_context, p_idempotency_key, p_unit);
  IF NOT EXISTS (
    SELECT 1 FROM public.competition_results cr
    JOIN public.competitions c ON c.id = cr.competition_id
    JOIN public.users u ON u.club_id = c.club_id
    WHERE cr.id = (v_result->>'resultId')::integer
      AND lower(trim(u.auth_uid)) = lower(trim(auth.uid()::text))
      AND u.role IN ('head_coach', 'coach')
  ) THEN RAISE EXCEPTION 'Résultat inaccessible.'; END IF;
  UPDATE public.competition_results SET
    measurement_type = p_metadata->>'measurement_type', performance_direction = p_metadata->>'performance_direction',
    venue_type = coalesce(p_metadata->>'venue_type', 'unknown'), wind_mps = nullif(p_metadata->>'wind_mps', '')::numeric,
    timing_method = coalesce(p_metadata->>'timing_method', 'unknown'), implement_weight_kg = nullif(p_metadata->>'implement_weight_kg', '')::numeric,
    hurdle_height_m = nullif(p_metadata->>'hurdle_height_m', '')::numeric, official_status = coalesce(p_metadata->>'official_status', 'unknown'),
    scoring_table_version = nullif(p_metadata->>'scoring_table_version', ''), metadata_version = coalesce(p_metadata->>'metadata_version', 'athleteos-performance-v1')
  WHERE id = (v_result->>'resultId')::integer;
  UPDATE public.records SET measurement_type = p_metadata->>'measurement_type', performance_direction = p_metadata->>'performance_direction'
  WHERE id = (v_result->>'recordId')::integer;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.create_solo_competition_result_v2(
  p_name text, p_date date, p_location text, p_type text, p_event text, p_result text,
  p_result_value numeric, p_higher_is_better boolean, p_context text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL, p_breakdown jsonb DEFAULT NULL, p_unit text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_result jsonb;
BEGIN
  IF coalesce(p_metadata->>'measurement_type', 'unknown') NOT IN ('time', 'distance', 'points')
    OR coalesce(p_metadata->>'performance_direction', 'unknown') NOT IN ('lower', 'higher')
    OR nullif(coalesce(p_unit, p_metadata->>'unit'), '') IS NULL
  THEN RAISE EXCEPTION 'Métadonnées de performance incomplètes.'; END IF;
  IF (p_metadata->>'performance_direction' = 'higher') IS DISTINCT FROM p_higher_is_better
  THEN RAISE EXCEPTION 'Sens de comparaison incohérent.'; END IF;
  v_result := public.create_solo_competition_result(p_name, p_date, p_location, p_type, p_event, p_result, p_result_value, p_higher_is_better, p_context, p_idempotency_key, p_breakdown, p_unit);
  IF NOT EXISTS (
    SELECT 1 FROM public.athlete_performances ap
    JOIN public.athletes a ON a.id = ap.athlete_id
    JOIN public.users u ON u.id = a.user_id
    WHERE ap.id = (v_result->>'performanceId')::bigint
      AND lower(trim(u.auth_uid)) = lower(trim(auth.uid()::text))
  ) THEN RAISE EXCEPTION 'Performance inaccessible.'; END IF;
  UPDATE public.competition_results SET
    measurement_type = p_metadata->>'measurement_type', performance_direction = p_metadata->>'performance_direction',
    venue_type = coalesce(p_metadata->>'venue_type', 'unknown'), wind_mps = nullif(p_metadata->>'wind_mps', '')::numeric,
    timing_method = coalesce(p_metadata->>'timing_method', 'unknown'), implement_weight_kg = nullif(p_metadata->>'implement_weight_kg', '')::numeric,
    hurdle_height_m = nullif(p_metadata->>'hurdle_height_m', '')::numeric, official_status = coalesce(p_metadata->>'official_status', 'unknown'),
    scoring_table_version = nullif(p_metadata->>'scoring_table_version', ''), metadata_version = coalesce(p_metadata->>'metadata_version', 'athleteos-performance-v1')
  WHERE id = (v_result->>'resultId')::integer;
  UPDATE public.athlete_performances SET
    measurement_type = p_metadata->>'measurement_type', performance_direction = p_metadata->>'performance_direction',
    venue_type = coalesce(p_metadata->>'venue_type', 'unknown'), wind_mps = nullif(p_metadata->>'wind_mps', '')::numeric,
    timing_method = coalesce(p_metadata->>'timing_method', 'unknown'), implement_weight_kg = nullif(p_metadata->>'implement_weight_kg', '')::numeric,
    hurdle_height_m = nullif(p_metadata->>'hurdle_height_m', '')::numeric, official_status = coalesce(p_metadata->>'official_status', 'unknown'),
    scoring_table_version = nullif(p_metadata->>'scoring_table_version', ''), metadata_version = coalesce(p_metadata->>'metadata_version', 'athleteos-performance-v1')
  WHERE id = (v_result->>'performanceId')::bigint;
  UPDATE public.records SET measurement_type = p_metadata->>'measurement_type', performance_direction = p_metadata->>'performance_direction'
  WHERE id = (v_result->>'recordId')::integer;
  RETURN v_result;
END; $$;

REVOKE ALL ON FUNCTION public.add_athlete_performance(text, text, numeric, date, text, jsonb, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_competition_result_v2(integer, integer, text, text, numeric, boolean, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_solo_competition_result_v2(text, date, text, text, text, text, numeric, boolean, text, text, jsonb, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_athlete_performance(text, text, numeric, date, text, jsonb, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_competition_result_v2(integer, integer, text, text, numeric, boolean, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_solo_competition_result_v2(text, date, text, text, text, text, numeric, boolean, text, text, jsonb, text, jsonb) TO authenticated;

COMMIT;
