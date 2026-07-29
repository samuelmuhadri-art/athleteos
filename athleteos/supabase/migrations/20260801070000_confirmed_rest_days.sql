BEGIN;

CREATE TABLE IF NOT EXISTS public.athlete_daily_load_days (
  athlete_id integer NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  load_date date NOT NULL,
  state text NOT NULL DEFAULT 'rest_confirmed' CHECK (state = 'rest_confirmed'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (athlete_id, load_date)
);

ALTER TABLE public.athlete_daily_load_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS athlete_daily_load_days_owner_or_coach
  ON public.athlete_daily_load_days;

CREATE POLICY athlete_daily_load_days_owner_or_coach
ON public.athlete_daily_load_days
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.athletes athlete
    WHERE athlete.id = athlete_daily_load_days.athlete_id
      AND athlete.club_id = public.get_my_club_id()
      AND (
        athlete.user_id = public.get_my_user_id()
        OR public.get_my_role() IN ('head_coach', 'coach')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.athletes athlete
    WHERE athlete.id = athlete_daily_load_days.athlete_id
      AND athlete.club_id = public.get_my_club_id()
      AND (
        athlete.user_id = public.get_my_user_id()
        OR public.get_my_role() IN ('head_coach', 'coach')
      )
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.athlete_daily_load_days TO authenticated;

COMMENT ON TABLE public.athlete_daily_load_days IS
  'Confirmation explicite des jours sans charge. Une absence de ligne reste une donnée inconnue, jamais un repos implicite.';

CREATE OR REPLACE VIEW public.daily_training_load
WITH (security_invoker = true)
AS
WITH session_days AS (
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
      )
      THEN sum(
        CASE
          WHEN sa.status = 'none' THEN 0
          ELSE sa.actual_duration_minutes * sa.rpe
        END
      )::integer
      ELSE NULL
    END AS raw_load,
    bool_and(
      sa.status = 'none'
      OR (
        sa.rpe IS NOT NULL
        AND sa.actual_duration_minutes IS NOT NULL
      )
    ) AS is_complete,
    bool_or(
      sa.status IS DISTINCT FROM 'none'
      AND sa.rpe IS NOT NULL
      AND sa.duration_source = 'planned_legacy'
    ) AS is_estimated,
    count(*)::integer AS assigned_session_count,
    count(*) FILTER (
      WHERE sa.status IS DISTINCT FROM 'none'
        AND (
          sa.rpe IS NULL
          OR sa.actual_duration_minutes IS NULL
        )
    )::integer AS unknown_session_count
  FROM public.session_athletes sa
  JOIN public.sessions s ON s.id = sa.session_id
  WHERE s.session_date IS NOT NULL
  GROUP BY sa.athlete_id, s.session_date, s.week
)
SELECT * FROM session_days
UNION ALL
SELECT
  rest.athlete_id,
  rest.load_date,
  EXTRACT(WEEK FROM rest.load_date)::integer AS week,
  0 AS raw_load,
  true AS is_complete,
  false AS is_estimated,
  0 AS assigned_session_count,
  0 AS unknown_session_count
FROM public.athlete_daily_load_days rest
WHERE rest.state = 'rest_confirmed'
  AND NOT EXISTS (
    SELECT 1
    FROM session_days day
    WHERE day.athlete_id = rest.athlete_id
      AND day.load_date = rest.load_date
  );

GRANT SELECT ON public.daily_training_load TO authenticated;

COMMIT;
