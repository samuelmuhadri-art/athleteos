BEGIN;
ALTER TABLE public.push_event_outbox DROP CONSTRAINT push_event_outbox_event_type_check;
ALTER TABLE public.push_event_outbox ADD CONSTRAINT push_event_outbox_event_type_check CHECK (event_type IN (
  'message_received','session_changed','session_proposed','session_response','social_post','result_added','goal_achieved',
  'competition_reminder','feedback_reminder','weekly_recap','weekly_report',
  'rule_wellness','rule_feedback','rule_competition','rule_load'
));

CREATE FUNCTION public.queue_alert_rule_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor integer; v_staff integer[]; v_kind text;
BEGIN
  IF NEW.rule_key IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_actor FROM public.users WHERE club_id=NEW.club_id AND role='head_coach' ORDER BY id LIMIT 1;
  IF v_actor IS NULL THEN RETURN NEW; END IF;
  SELECT array_agg(id ORDER BY id) INTO v_staff FROM public.users WHERE club_id=NEW.club_id
    AND (role='head_coach' OR (role='coach' AND NEW.recipient_scope='staff'));
  v_kind:=CASE NEW.type WHEN 'wellness' THEN 'rule_wellness' WHEN 'absence' THEN 'rule_feedback'
    WHEN 'competition' THEN 'rule_competition' WHEN 'charge' THEN 'rule_load' END;
  IF v_kind IS NOT NULL THEN
    INSERT INTO public.push_event_outbox(club_id,actor_user_id,event_type,entity_id,user_ids,dedupe_key)
      VALUES(NEW.club_id,v_actor,v_kind,NEW.id,v_staff,'configured-alert:'||NEW.id)
      ON CONFLICT(dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER queue_alert_rule_push AFTER INSERT ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.queue_alert_rule_push();
REVOKE ALL ON FUNCTION public.queue_alert_rule_push() FROM PUBLIC, anon, authenticated;
COMMIT;
