-- Prevent collisions between the same ISO week number in different years and
-- make weekly/session reminder creation safe under retries and concurrent cron
-- invocations. Existing nullable dedupe keys keep historical writes compatible.

BEGIN;

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS dedupe_key text;

ALTER TABLE public.athlete_notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS alerts_club_type_dedupe_key_uidx
  ON public.alerts (club_id, type, dedupe_key);

CREATE UNIQUE INDEX IF NOT EXISTS athlete_notifications_athlete_type_dedupe_key_uidx
  ON public.athlete_notifications (athlete_id, type, dedupe_key);

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
      OR (sa.rpe IS NOT NULL AND sa.actual_duration_minutes IS NOT NULL)
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
  )::integer AS unknown_session_count,
  EXTRACT(ISOYEAR FROM s.session_date)::integer AS iso_year
FROM public.session_athletes sa
JOIN public.sessions s ON s.id = sa.session_id
WHERE s.session_date IS NOT NULL
GROUP BY
  sa.athlete_id,
  s.session_date,
  s.week,
  EXTRACT(ISOYEAR FROM s.session_date);

GRANT SELECT ON public.daily_training_load TO authenticated;

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
  count(*) FILTER (WHERE d.is_estimated)::integer AS estimated_days,
  d.iso_year
FROM public.daily_training_load d
GROUP BY d.athlete_id, d.week, d.iso_year;

GRANT SELECT ON public.weekly_charge TO authenticated;

COMMIT;
