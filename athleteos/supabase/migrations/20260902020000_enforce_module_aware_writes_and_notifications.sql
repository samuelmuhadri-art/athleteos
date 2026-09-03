-- Server-side enforcement for configurable modules.
-- Historical rows stay readable and untouched; only new mutations are guarded.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_athlete_module_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_athlete_id integer;
  v_module_key text := TG_ARGV[0];
BEGIN
  IF auth.role() = 'service_role' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  v_athlete_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.athlete_id ELSE NEW.athlete_id END;
  IF NOT public.is_athlete_module_enabled(v_athlete_id, v_module_key) THEN
    RAISE EXCEPTION 'Ce module est désactivé pour cet athlète.' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_club_module_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_club_id integer;
  v_module_key text := TG_ARGV[0];
BEGIN
  IF auth.role() = 'service_role' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  v_club_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.club_id ELSE NEW.club_id END;
  IF NOT public.is_club_module_enabled(v_club_id, v_module_key) THEN
    RAISE EXCEPTION 'Ce module est désactivé pour ce club.' USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_session_athlete_modules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_athlete_id integer := CASE WHEN TG_OP = 'DELETE' THEN OLD.athlete_id ELSE NEW.athlete_id END;
  v_feedback_changed boolean := false;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP IN ('INSERT', 'DELETE') AND NOT public.is_athlete_module_enabled(v_athlete_id, 'planning') THEN
    RAISE EXCEPTION 'Le planning est désactivé pour cet athlète.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    v_feedback_changed := NEW.status IS DISTINCT FROM OLD.status
      OR NEW.feeling IS DISTINCT FROM OLD.feeling
      OR NEW.fatigue IS DISTINCT FROM OLD.fatigue
      OR NEW.comment IS DISTINCT FROM OLD.comment
      OR NEW.rpe IS DISTINCT FROM OLD.rpe
      OR NEW.actual_duration_minutes IS DISTINCT FROM OLD.actual_duration_minutes
      OR NEW.duration_source IS DISTINCT FROM OLD.duration_source
      OR NEW.feedback_submitted_at IS DISTINCT FROM OLD.feedback_submitted_at;
    IF v_feedback_changed AND NOT public.is_athlete_module_enabled(v_athlete_id, 'session_feedback') THEN
      RAISE EXCEPTION 'Le feedback de séance est désactivé pour cet athlète.' USING ERRCODE = '42501';
    END IF;
    IF NOT v_feedback_changed AND NOT public.is_athlete_module_enabled(v_athlete_id, 'planning') THEN
      RAISE EXCEPTION 'Le planning est désactivé pour cet athlète.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_message_module()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sender_athlete integer;
  v_receiver_athlete integer;
  v_club_id integer;
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  SELECT u.club_id INTO v_club_id FROM public.users u WHERE u.id = NEW.sender_id;
  IF NOT public.is_club_module_enabled(v_club_id, 'messaging') THEN
    RAISE EXCEPTION 'La messagerie est désactivée pour ce club.' USING ERRCODE = '42501';
  END IF;
  SELECT a.id INTO v_sender_athlete FROM public.athletes a WHERE a.user_id = NEW.sender_id;
  SELECT a.id INTO v_receiver_athlete FROM public.athletes a WHERE a.user_id = NEW.receiver_id;
  IF (v_sender_athlete IS NOT NULL AND NOT public.is_athlete_module_enabled(v_sender_athlete, 'messaging'))
    OR (v_receiver_athlete IS NOT NULL AND NOT public.is_athlete_module_enabled(v_receiver_athlete, 'messaging')) THEN
    RAISE EXCEPTION 'La messagerie est désactivée pour cet athlète.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
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
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.suppress_disabled_athlete_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_module_key text := public.module_key_for_notification_type(NEW.type);
BEGIN
  IF v_module_key IS NOT NULL AND NOT public.is_athlete_module_enabled(NEW.athlete_id, v_module_key) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.suppress_disabled_coach_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_module_key text := public.module_key_for_notification_type(NEW.type);
BEGIN
  IF v_module_key IS NULL THEN RETURN NEW; END IF;
  IF NEW.athlete_id IS NOT NULL THEN
    IF NOT public.is_athlete_module_enabled(NEW.athlete_id, v_module_key) THEN RETURN NULL; END IF;
  ELSIF NOT public.is_club_module_enabled(NEW.club_id, v_module_key) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS athlete_wellness_module_guard ON public.athlete_wellness;
CREATE TRIGGER athlete_wellness_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.athlete_wellness
FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_module_write('wellness');
DROP TRIGGER IF EXISTS injuries_module_guard ON public.injuries;
CREATE TRIGGER injuries_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.injuries
FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_module_write('health');
DROP TRIGGER IF EXISTS athlete_goals_module_guard ON public.athlete_goals;
CREATE TRIGGER athlete_goals_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.athlete_goals
FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_module_write('performances');
DROP TRIGGER IF EXISTS athlete_performances_module_guard ON public.athlete_performances;
CREATE TRIGGER athlete_performances_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.athlete_performances
FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_module_write('performances');
DROP TRIGGER IF EXISTS records_module_guard ON public.records;
CREATE TRIGGER records_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_module_write('performances');
DROP TRIGGER IF EXISTS performance_history_module_guard ON public.performance_history;
CREATE TRIGGER performance_history_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.performance_history
FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_module_write('performances');
DROP TRIGGER IF EXISTS competition_results_module_guard ON public.competition_results;
CREATE TRIGGER competition_results_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.competition_results
FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_module_write('performances');
DROP TRIGGER IF EXISTS competition_athletes_module_guard ON public.competition_athletes;
CREATE TRIGGER competition_athletes_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.competition_athletes
FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_module_write('performances');
DROP TRIGGER IF EXISTS daily_load_days_module_guard ON public.athlete_daily_load_days;
CREATE TRIGGER daily_load_days_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.athlete_daily_load_days
FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_module_write('training_load');
DROP TRIGGER IF EXISTS social_posts_module_guard ON public.social_posts;
CREATE TRIGGER social_posts_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.social_posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_module_write('social');
DROP TRIGGER IF EXISTS social_comments_module_guard ON public.social_comments;
CREATE TRIGGER social_comments_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.social_comments
FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_module_write('social');
DROP TRIGGER IF EXISTS social_reactions_module_guard ON public.social_reactions;
CREATE TRIGGER social_reactions_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.social_reactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_athlete_module_write('social');

DROP TRIGGER IF EXISTS sessions_module_guard ON public.sessions;
CREATE TRIGGER sessions_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_club_module_write('planning');
DROP TRIGGER IF EXISTS competitions_module_guard ON public.competitions;
CREATE TRIGGER competitions_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.competitions
FOR EACH ROW EXECUTE FUNCTION public.enforce_club_module_write('performances');
DROP TRIGGER IF EXISTS session_athletes_module_guard ON public.session_athletes;
CREATE TRIGGER session_athletes_module_guard BEFORE INSERT OR UPDATE OR DELETE ON public.session_athletes
FOR EACH ROW EXECUTE FUNCTION public.enforce_session_athlete_modules();
DROP TRIGGER IF EXISTS messages_module_guard ON public.messages;
CREATE TRIGGER messages_module_guard BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_module();

DROP TRIGGER IF EXISTS athlete_notifications_module_guard ON public.athlete_notifications;
CREATE TRIGGER athlete_notifications_module_guard BEFORE INSERT ON public.athlete_notifications
FOR EACH ROW EXECUTE FUNCTION public.suppress_disabled_athlete_notification();
DROP TRIGGER IF EXISTS alerts_module_guard ON public.alerts;
CREATE TRIGGER alerts_module_guard BEFORE INSERT ON public.alerts
FOR EACH ROW EXECUTE FUNCTION public.suppress_disabled_coach_alert();

REVOKE ALL ON FUNCTION public.enforce_athlete_module_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_club_module_write() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_session_athlete_modules() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_message_module() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.suppress_disabled_athlete_notification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.suppress_disabled_coach_alert() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.module_key_for_notification_type(text) TO authenticated, service_role;

COMMIT;
