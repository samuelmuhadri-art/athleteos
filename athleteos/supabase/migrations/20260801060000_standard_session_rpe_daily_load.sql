BEGIN;

-- AthleteOS charge model v2
-- Global internal load = actual duration in minutes x session RPE CR10.
-- Category-specific constraints stay in the separate axis model and are no
-- longer hidden multipliers of the global session-RPE value.

ALTER TABLE public.session_athletes
  ADD COLUMN IF NOT EXISTS actual_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS duration_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.session_athletes'::regclass
      AND conname = 'session_athletes_actual_duration_check'
  ) THEN
    ALTER TABLE public.session_athletes
      ADD CONSTRAINT session_athletes_actual_duration_check
      CHECK (actual_duration_minutes IS NULL OR actual_duration_minutes BETWEEN 1 AND 1440);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.session_athletes'::regclass
      AND conname = 'session_athletes_duration_source_check'
  ) THEN
    ALTER TABLE public.session_athletes
      ADD CONSTRAINT session_athletes_duration_source_check
      CHECK (duration_source IS NULL OR duration_source IN ('reported', 'planned_legacy'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.session_athletes.actual_duration_minutes IS
  'Durée réellement effectuée et déclarée pour le calcul session-RPE standard.';
COMMENT ON COLUMN public.session_athletes.duration_source IS
  'reported = durée déclarée; planned_legacy = ancienne durée planifiée conservée et signalée comme estimation.';

-- Preserve historical charts without pretending that the planned duration was
-- measured. Scientific daily metrics can exclude these estimated points.
UPDATE public.session_athletes sa
SET
  actual_duration_minutes = s.duration_minutes,
  duration_source = 'planned_legacy'
FROM public.sessions s
WHERE s.id = sa.session_id
  AND sa.rpe IS NOT NULL
  AND sa.actual_duration_minutes IS NULL
  AND s.duration_minutes IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.session_athletes'::regclass
      AND conname = 'session_athletes_rpe_requires_duration_check'
  ) THEN
    ALTER TABLE public.session_athletes
      ADD CONSTRAINT session_athletes_rpe_requires_duration_check
      CHECK (
        rpe IS NULL
        OR status = 'none'
        OR (actual_duration_minutes IS NOT NULL AND duration_source IS NOT NULL)
      );
  END IF;
END;
$$;

UPDATE public.charge_model_versions SET is_active = false WHERE is_active;
INSERT INTO public.charge_model_versions (
  version, load_coefficients, recovery_hours, is_active, notes
) VALUES (
  'v2-session-rpe-standard',
  '{"force":1,"sprint":1,"haies":1,"lancer":1,"saut":1,"endurance":1,"technique":1,"mobilite":1,"recuperation":1}'::jsonb,
  '{"sprint":72,"haies":72,"force":72,"saut":48,"lancer":48,"endurance":36,"technique":24,"mobilite":12,"recuperation":12}'::jsonb,
  true,
  'Session-RPE standard durée réelle x RPE, sans coefficient ni division. recovery_hours est une règle configurable d espacement de programmation, pas une estimation physiologique.'
)
ON CONFLICT (version) DO UPDATE SET
  load_coefficients = EXCLUDED.load_coefficients,
  recovery_hours = EXCLUDED.recovery_hours,
  is_active = true,
  notes = EXCLUDED.notes;

CREATE OR REPLACE VIEW public.daily_training_load
WITH (security_invoker = true)
AS
SELECT
  sa.athlete_id,
  s.session_date AS load_date,
  s.week,
  CASE
    WHEN bool_and(
      sa.status = 'none'
      OR (
        sa.rpe IS NOT NULL
        AND sa.actual_duration_minutes IS NOT NULL
      )
    ) THEN SUM(
      CASE
        WHEN sa.status = 'none' THEN 0
        ELSE sa.actual_duration_minutes * sa.rpe
      END
    )::integer
    ELSE NULL
  END AS raw_load,
  bool_and(
    sa.status = 'none'
    OR (sa.rpe IS NOT NULL AND sa.actual_duration_minutes IS NOT NULL)
  ) AS is_complete,
  bool_or(
    sa.status IS DISTINCT FROM 'none'
    AND sa.rpe IS NOT NULL
    AND sa.duration_source = 'planned_legacy'
  ) AS is_estimated,
  count(*)::integer AS assigned_session_count,
  count(*) FILTER (
    WHERE sa.status IS DISTINCT FROM 'none'
      AND (sa.rpe IS NULL OR sa.actual_duration_minutes IS NULL)
  )::integer AS unknown_session_count
FROM public.session_athletes sa
JOIN public.sessions s ON s.id = sa.session_id
WHERE s.session_date IS NOT NULL
GROUP BY sa.athlete_id, s.session_date, s.week;

GRANT SELECT ON public.daily_training_load TO authenticated;

-- Keep the historical API shape and add daily detail/quality columns at the
-- end. Existing pages continue reading athlete_id/week/raw_load unchanged.
CREATE OR REPLACE VIEW public.weekly_charge
WITH (security_invoker = true)
AS
SELECT
  d.athlete_id,
  d.week,
  CASE
    WHEN bool_and(d.raw_load IS NOT NULL) THEN SUM(d.raw_load)::integer
    ELSE NULL
  END AS raw_load,
  jsonb_agg(
    jsonb_build_object(
      'date', d.load_date,
      'load', d.raw_load,
      'estimated', d.is_estimated,
      'complete', d.is_complete
    ) ORDER BY d.load_date
  ) AS daily_loads,
  count(*) FILTER (WHERE d.raw_load IS NOT NULL)::integer AS known_days,
  count(*) FILTER (WHERE d.raw_load IS NULL)::integer AS unknown_days,
  count(*) FILTER (WHERE d.is_estimated)::integer AS estimated_days
FROM public.daily_training_load d
GROUP BY d.athlete_id, d.week;

GRANT SELECT ON public.weekly_charge TO authenticated;

COMMIT;
