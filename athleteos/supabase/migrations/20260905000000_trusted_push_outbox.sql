BEGIN;

-- Sortie uniquement : aucun client ne peut écrire/lire cette file ni choisir ses destinataires.
-- Les données métier, calculs et policies existantes ne sont pas modifiés.
CREATE TABLE public.push_event_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  club_id integer NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  actor_user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('message_received','session_changed','session_proposed','session_response','social_post','result_added','goal_achieved','competition_reminder','feedback_reminder','weekly_recap','weekly_report')),
  entity_id bigint NOT NULL,
  athlete_ids integer[] NOT NULL DEFAULT '{}',
  user_ids integer[] NOT NULL DEFAULT '{}',
  dedupe_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0
);
CREATE INDEX push_event_outbox_pending_idx ON public.push_event_outbox(actor_user_id, created_at) WHERE completed_at IS NULL;
ALTER TABLE public.push_event_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_event_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.push_event_outbox TO service_role;

CREATE FUNCTION public.queue_trusted_push_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor public.users%ROWTYPE;
  subject_club integer;
  subject_athlete integer;
  session_row public.sessions%ROWTYPE;
  receiver public.users%ROWTYPE;
  kind text;
  subject_id bigint;
  recipients integer[] := '{}';
  staff integer[] := '{}';
  event_key text;
BEGIN
  SELECT * INTO actor FROM public.users WHERE auth_uid = auth.uid()::text;
  -- Les tâches service_role gardent leur pipeline serveur existant.
  IF actor.id IS NULL OR actor.role NOT IN ('head_coach','coach','athlete') THEN RETURN NEW; END IF;
  subject_id := NEW.id;
  event_key := txid_current()::text || ':' || TG_TABLE_NAME || ':' || NEW.id::text;

  IF TG_TABLE_NAME = 'messages' THEN
    IF NEW.sender_id <> actor.id THEN RETURN NEW; END IF;
    SELECT * INTO receiver FROM public.users WHERE id = NEW.receiver_id AND club_id = actor.club_id;
    IF receiver.id IS NULL THEN RETURN NEW; END IF;
    subject_club := actor.club_id;
    kind := 'message_received';
    IF receiver.role = 'athlete' THEN
      SELECT coalesce(array_agg(id), '{}') INTO recipients FROM public.athletes WHERE user_id = receiver.id AND club_id = actor.club_id;
    ELSE staff := ARRAY[receiver.id]; END IF;

  ELSIF TG_TABLE_NAME IN ('sessions','session_athletes') THEN
    IF TG_TABLE_NAME = 'sessions' THEN
      SELECT * INTO session_row FROM public.sessions WHERE id = NEW.id;
      IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
    ELSE
      SELECT * INTO session_row FROM public.sessions WHERE id = NEW.session_id;
    END IF;
    IF session_row.id IS NULL OR session_row.club_id <> actor.club_id THEN RETURN NEW; END IF;
    subject_club := session_row.club_id;
    subject_id := session_row.id;
    event_key := txid_current()::text || ':session:' || session_row.id::text;
    IF TG_TABLE_NAME = 'session_athletes' AND TG_OP = 'UPDATE' THEN
      IF actor.role <> 'athlete' OR NEW.rsvp_status IS NOT DISTINCT FROM OLD.rsvp_status
        OR coalesce(NEW.rsvp_status, '') NOT IN ('unavailable','unsure') THEN RETURN NEW; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.athletes WHERE id = NEW.athlete_id AND user_id = actor.id AND club_id = actor.club_id) THEN RETURN NEW; END IF;
      kind := 'session_response';
      event_key := event_key || ':response:' || NEW.athlete_id::text;
    ELSIF actor.role = 'athlete' THEN
      IF session_row.created_by <> actor.id THEN RETURN NEW; END IF;
      kind := 'session_proposed';
    ELSE
      kind := 'session_changed';
      SELECT coalesce(array_agg(DISTINCT a.id), '{}') INTO recipients
        FROM public.session_athletes sa JOIN public.athletes a ON a.id = sa.athlete_id
        WHERE sa.session_id = session_row.id AND a.club_id = actor.club_id;
    END IF;
    IF kind IN ('session_response','session_proposed') THEN
      SELECT coalesce(array_agg(id), '{}') INTO staff FROM (
        SELECT id FROM public.users WHERE club_id = actor.club_id AND role IN ('head_coach','coach')
        ORDER BY (id = session_row.created_by) DESC, (role = 'head_coach') DESC, id LIMIT 1
      ) chosen;
    END IF;

  ELSIF TG_TABLE_NAME = 'social_posts' THEN
    subject_club := NEW.club_id;
    subject_athlete := NEW.athlete_id;
    IF subject_club <> actor.club_id OR NOT EXISTS(SELECT 1 FROM public.athletes WHERE id = subject_athlete AND club_id = actor.club_id AND (user_id = actor.id OR actor.role IN ('head_coach','coach'))) THEN RETURN NEW; END IF;
    kind := 'social_post';
    SELECT coalesce(array_agg(id), '{}') INTO recipients FROM public.athletes WHERE club_id = actor.club_id AND id <> subject_athlete;
    SELECT coalesce(array_agg(id), '{}') INTO staff FROM (
      SELECT id FROM public.users WHERE club_id = actor.club_id AND role IN ('head_coach','coach') AND id <> actor.id ORDER BY (role = 'head_coach') DESC, id LIMIT 1
    ) chosen;

  ELSIF TG_TABLE_NAME IN ('athlete_notifications','alerts') THEN
    -- Les récaps/rapports sont calculés à la demande. Leur texte client n'est
    -- jamais utilisé ; période, auteur et destinataires sont vérifiés ici.
    IF NEW.club_id <> actor.club_id THEN RETURN NEW; END IF;
    IF NEW.type IN ('weekly_recap','recap') AND extract(isodow FROM current_date) IN (6,7,1) THEN kind := 'weekly_recap';
    ELSIF NEW.type = 'weekly_report' AND extract(isodow FROM current_date) IN (7,1) THEN kind := 'weekly_report';
    ELSE RETURN NEW; END IF;
    subject_club := actor.club_id;
    IF TG_TABLE_NAME = 'athlete_notifications' THEN
      IF NOT EXISTS(SELECT 1 FROM public.athletes WHERE id = NEW.athlete_id AND club_id = actor.club_id AND (user_id = actor.id OR actor.role IN ('head_coach','coach'))) THEN RETURN NEW; END IF;
      recipients := ARRAY[NEW.athlete_id];
      event_key := actor.club_id::text || ':' || kind || ':athlete:' || NEW.athlete_id::text;
    ELSE
      IF actor.role NOT IN ('head_coach','coach') THEN RETURN NEW; END IF;
      staff := ARRAY[actor.id];
      event_key := actor.club_id::text || ':' || kind || ':coach:' || actor.id::text;
    END IF;
    event_key := event_key || ':' || to_char(current_date, 'IYYY-IW');

  ELSIF TG_TABLE_NAME IN ('competition_results','athlete_goals') THEN
    subject_athlete := NEW.athlete_id;
    SELECT club_id INTO subject_club FROM public.athletes WHERE id = subject_athlete
      AND (user_id = actor.id OR actor.role IN ('head_coach','coach'));
    IF subject_club IS DISTINCT FROM actor.club_id THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME = 'athlete_goals' THEN
      IF NOT coalesce(NEW.achieved, false) OR (TG_OP = 'UPDATE' AND coalesce(OLD.achieved, false)) THEN RETURN NEW; END IF;
      kind := 'goal_achieved';
    ELSE
      IF NOT EXISTS(SELECT 1 FROM public.competitions WHERE id = NEW.competition_id AND club_id = actor.club_id) THEN RETURN NEW; END IF;
      kind := 'result_added';
    END IF;
    recipients := ARRAY[subject_athlete];
  END IF;

  IF kind IS NOT NULL AND cardinality(recipients) + cardinality(staff) > 0 THEN
    INSERT INTO public.push_event_outbox(club_id, actor_user_id, event_type, entity_id, athlete_ids, user_ids, dedupe_key)
    VALUES(subject_club, actor.id, kind, subject_id, recipients, staff, event_key)
    ON CONFLICT(dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_trusted_push_event() FROM PUBLIC, anon, authenticated;

-- Différés au COMMIT : les participants créés dans la même RPC existent déjà.
CREATE CONSTRAINT TRIGGER push_messages AFTER INSERT ON public.messages DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.queue_trusted_push_event();
CREATE CONSTRAINT TRIGGER push_sessions AFTER INSERT OR UPDATE ON public.sessions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.queue_trusted_push_event();
CREATE CONSTRAINT TRIGGER push_session_athletes AFTER INSERT OR UPDATE ON public.session_athletes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.queue_trusted_push_event();
CREATE CONSTRAINT TRIGGER push_social AFTER INSERT ON public.social_posts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.queue_trusted_push_event();
CREATE CONSTRAINT TRIGGER push_results AFTER INSERT ON public.competition_results DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.queue_trusted_push_event();
CREATE CONSTRAINT TRIGGER push_goals AFTER INSERT OR UPDATE ON public.athlete_goals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.queue_trusted_push_event();
CREATE CONSTRAINT TRIGGER push_athlete_weekly AFTER INSERT ON public.athlete_notifications DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.queue_trusted_push_event();
CREATE CONSTRAINT TRIGGER push_coach_weekly AFTER INSERT ON public.alerts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.queue_trusted_push_event();

CREATE FUNCTION public.claim_trusted_push_events(p_actor_user_id integer)
RETURNS SETOF public.push_event_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH candidates AS (
    SELECT e.id FROM public.push_event_outbox e JOIN public.users u ON u.id = e.actor_user_id AND u.club_id = e.club_id
    WHERE e.actor_user_id = p_actor_user_id AND e.completed_at IS NULL AND e.attempts < 3
      AND e.created_at > now() - interval '24 hours'
      AND (e.claimed_at IS NULL OR e.claimed_at < now() - interval '2 minutes')
    ORDER BY e.id FOR UPDATE OF e SKIP LOCKED LIMIT 20
  )
  UPDATE public.push_event_outbox e SET claimed_at = clock_timestamp(), attempts = attempts + 1
  FROM candidates c WHERE e.id = c.id RETURNING e.*;
$$;
REVOKE ALL ON FUNCTION public.claim_trusted_push_events(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_trusted_push_events(integer) TO service_role;

-- Rappels contextuels : une intention explicite, des destinataires recalculés et un dédoublonnage journalier.
CREATE FUNCTION public.queue_trusted_push_reminder(p_actor_user_id integer, p_event_type text, p_entity_id integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor public.users%ROWTYPE; recipients integer[]; scope_key text;
BEGIN
  SELECT * INTO actor FROM public.users WHERE id = p_actor_user_id;
  IF actor.id IS NULL OR actor.role NOT IN ('coach','head_coach') THEN RAISE EXCEPTION 'Reminder forbidden' USING ERRCODE = '42501'; END IF;
  IF p_event_type = 'competition_reminder' THEN
    IF NOT EXISTS(SELECT 1 FROM public.competitions WHERE id = p_entity_id AND club_id = actor.club_id AND date BETWEEN current_date AND current_date + 7) THEN RETURN; END IF;
    SELECT coalesce(array_agg(DISTINCT a.id), '{}') INTO recipients FROM public.competition_athletes ca JOIN public.athletes a ON a.id = ca.athlete_id
      WHERE ca.competition_id = p_entity_id AND a.club_id = actor.club_id;
  ELSIF p_event_type = 'feedback_reminder' THEN
    IF NOT EXISTS(SELECT 1 FROM public.sessions WHERE id = p_entity_id AND club_id = actor.club_id AND session_date <= current_date) THEN RETURN; END IF;
    SELECT coalesce(array_agg(DISTINCT a.id), '{}') INTO recipients FROM public.session_athletes sa JOIN public.athletes a ON a.id = sa.athlete_id
      WHERE sa.session_id = p_entity_id AND a.club_id = actor.club_id AND sa.status IS DISTINCT FROM 'none'
        AND (sa.rpe IS NULL OR sa.duration_source IS DISTINCT FROM 'reported');
  ELSE RAISE EXCEPTION 'Unknown reminder' USING ERRCODE = '22023'; END IF;
  IF cardinality(recipients) = 0 THEN RETURN; END IF;
  scope_key := actor.club_id::text || ':' || p_event_type || ':' || p_entity_id::text || ':' || current_date::text;
  INSERT INTO public.push_event_outbox(club_id, actor_user_id, event_type, entity_id, athlete_ids, dedupe_key)
  VALUES(actor.club_id, actor.id, p_event_type, p_entity_id, recipients, scope_key) ON CONFLICT(dedupe_key) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_trusted_push_reminder(integer,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_trusted_push_reminder(integer,text,integer) TO service_role;

COMMIT;
