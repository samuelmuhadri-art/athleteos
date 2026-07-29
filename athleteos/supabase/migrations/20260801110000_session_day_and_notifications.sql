BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by integer REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.session_athletes
  ADD COLUMN IF NOT EXISTS attendance_status text,
  ADD COLUMN IF NOT EXISTS attendance_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS rsvp_status text,
  ADD COLUMN IF NOT EXISTS rsvp_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS coach_note text,
  ADD COLUMN IF NOT EXISTS feedback_submitted_at timestamptz;

ALTER TABLE public.athlete_notifications
  ADD COLUMN IF NOT EXISTS session_id integer REFERENCES public.sessions(id) ON DELETE CASCADE;

DO $$ BEGIN
  ALTER TABLE public.sessions ADD CONSTRAINT sessions_lifecycle_status_check
    CHECK (lifecycle_status IN ('planned','live','completed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.session_athletes ADD CONSTRAINT session_athletes_attendance_status_check
    CHECK (attendance_status IS NULL OR attendance_status IN ('present','late','absent','injured'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.session_athletes ADD CONSTRAINT session_athletes_rsvp_status_check
    CHECK (rsvp_status IS NULL OR rsvp_status IN ('going','unsure','unavailable'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.session_athletes ADD CONSTRAINT session_athletes_coach_note_length_check
    CHECK (coach_note IS NULL OR char_length(coach_note) <= 1000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.session_athletes
SET attendance_status = CASE
  WHEN status = 'none' THEN 'absent'
  WHEN status IN ('done','partial') THEN 'present'
  ELSE NULL
END
WHERE attendance_status IS NULL AND status IS NOT NULL;

CREATE INDEX IF NOT EXISTS sessions_club_lifecycle_date_idx
  ON public.sessions (club_id, lifecycle_status, session_date);
CREATE INDEX IF NOT EXISTS session_athletes_pending_feedback_idx
  ON public.session_athletes (session_id, athlete_id)
  WHERE rpe IS NULL AND status IN ('done','partial');
CREATE INDEX IF NOT EXISTS athlete_notifications_session_idx
  ON public.athlete_notifications (session_id, athlete_id, type)
  WHERE session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_session_day_coach_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND public.get_my_role() = 'athlete' THEN
    IF NEW.session_id IS DISTINCT FROM OLD.session_id
      OR NEW.athlete_id IS DISTINCT FROM OLD.athlete_id
      OR NEW.attendance_status IS DISTINCT FROM OLD.attendance_status
      OR NEW.attendance_marked_at IS DISTINCT FROM OLD.attendance_marked_at
      OR NEW.coach_note IS DISTINCT FROM OLD.coach_note THEN
      RAISE EXCEPTION 'Les présences réelles et observations sont réservées au staff.';
    END IF;
  END IF;
  IF NEW.rpe IS NOT NULL
    AND NEW.actual_duration_minutes IS NOT NULL
    AND NEW.duration_source = 'reported'
    AND (OLD.rpe IS DISTINCT FROM NEW.rpe OR OLD.actual_duration_minutes IS DISTINCT FROM NEW.actual_duration_minutes) THEN
    NEW.feedback_submitted_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS session_day_protect_coach_fields ON public.session_athletes;
CREATE TRIGGER session_day_protect_coach_fields
  BEFORE UPDATE ON public.session_athletes
  FOR EACH ROW EXECUTE FUNCTION public.protect_session_day_coach_fields();

CREATE OR REPLACE FUNCTION public.protect_session_lifecycle_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND public.get_my_role() = 'athlete'
    AND (NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status
      OR NEW.started_at IS DISTINCT FROM OLD.started_at
      OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
      OR NEW.closed_by IS DISTINCT FROM OLD.closed_by) THEN
    RAISE EXCEPTION 'Le démarrage et la clôture sont réservés au staff.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS session_day_protect_lifecycle ON public.sessions;
CREATE TRIGGER session_day_protect_lifecycle
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.protect_session_lifecycle_fields();

DROP POLICY IF EXISTS "sessions_club" ON public.sessions;
DROP POLICY IF EXISTS "sessions_club_read" ON public.sessions;
DROP POLICY IF EXISTS "sessions_coach_manage" ON public.sessions;
DROP POLICY IF EXISTS "sessions_athlete_create" ON public.sessions;
DROP POLICY IF EXISTS "sessions_athlete_update_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_athlete_delete_own" ON public.sessions;
CREATE POLICY "sessions_club_read" ON public.sessions
  FOR SELECT TO authenticated USING (club_id = public.get_my_club_id());
CREATE POLICY "sessions_coach_manage" ON public.sessions
  FOR ALL TO authenticated
  USING (club_id = public.get_my_club_id() AND public.get_my_role() IN ('head_coach','coach'))
  WITH CHECK (club_id = public.get_my_club_id() AND public.get_my_role() IN ('head_coach','coach'));
CREATE POLICY "sessions_athlete_create" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (club_id = public.get_my_club_id() AND created_by = public.get_my_user_id() AND public.get_my_role() = 'athlete');
CREATE POLICY "sessions_athlete_update_own" ON public.sessions
  FOR UPDATE TO authenticated
  USING (club_id = public.get_my_club_id() AND created_by = public.get_my_user_id() AND public.get_my_role() = 'athlete')
  WITH CHECK (club_id = public.get_my_club_id() AND created_by = public.get_my_user_id() AND public.get_my_role() = 'athlete');
CREATE POLICY "sessions_athlete_delete_own" ON public.sessions
  FOR DELETE TO authenticated
  USING (club_id = public.get_my_club_id() AND created_by = public.get_my_user_id() AND public.get_my_role() = 'athlete');

-- Les anciennes policies donnaient à tout membre du club le droit de modifier
-- les réponses des autres athlètes. On conserve toutes les fonctions légitimes
-- en séparant lecture, gestion coach et réponse personnelle.
DROP POLICY IF EXISTS "session_athletes_club" ON public.session_athletes;
DROP POLICY IF EXISTS "session_athletes_club_read" ON public.session_athletes;
DROP POLICY IF EXISTS "session_athletes_coach_manage" ON public.session_athletes;
DROP POLICY IF EXISTS "session_athletes_athlete_respond" ON public.session_athletes;
DROP POLICY IF EXISTS "session_athletes_athlete_link_created_session" ON public.session_athletes;
CREATE POLICY "session_athletes_club_read" ON public.session_athletes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = session_athletes.session_id AND s.club_id = public.get_my_club_id()
  ));
CREATE POLICY "session_athletes_coach_manage" ON public.session_athletes
  FOR ALL TO authenticated
  USING (
    public.get_my_role() IN ('head_coach','coach')
    AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_athletes.session_id AND s.club_id = public.get_my_club_id())
  )
  WITH CHECK (
    public.get_my_role() IN ('head_coach','coach')
    AND EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_athletes.session_id AND s.club_id = public.get_my_club_id())
  );
CREATE POLICY "session_athletes_athlete_respond" ON public.session_athletes
  FOR UPDATE TO authenticated
  USING (athlete_id = public.get_my_athlete_id())
  WITH CHECK (athlete_id = public.get_my_athlete_id());
CREATE POLICY "session_athletes_athlete_link_created_session" ON public.session_athletes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'athlete'
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.athletes a ON a.id = session_athletes.athlete_id
      WHERE s.id = session_athletes.session_id
        AND s.created_by = public.get_my_user_id()
        AND s.club_id = public.get_my_club_id()
        AND a.club_id = s.club_id
    )
  );

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.unschedule('daily-session-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-session-reminders');
SELECT cron.schedule(
  'daily-session-reminders',
  '30 5 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://kuqafsmkwajeipzolbky.supabase.co/functions/v1/session-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'weekly_cron_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $job$
);

COMMIT;
