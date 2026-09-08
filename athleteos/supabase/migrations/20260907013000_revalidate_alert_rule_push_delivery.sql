BEGIN;
-- Reuse the trusted outbox claim, retaining legacy event behavior.
CREATE OR REPLACE FUNCTION public.claim_trusted_push_events(p_actor_user_id integer)
RETURNS SETOF public.push_event_outbox LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH candidates AS (
    SELECT e.id FROM public.push_event_outbox e JOIN public.users u ON u.id=e.actor_user_id AND u.club_id=e.club_id
    WHERE e.actor_user_id=p_actor_user_id AND e.completed_at IS NULL AND e.attempts<3
      AND e.created_at>now()-CASE WHEN e.event_type IN ('rule_wellness','rule_feedback','rule_competition','rule_load')
        THEN interval '7 days' ELSE interval '24 hours' END
      AND (e.claimed_at IS NULL OR e.claimed_at<now()-interval '2 minutes')
      AND (e.event_type NOT IN ('rule_wellness','rule_feedback','rule_competition','rule_load') OR EXISTS(
        SELECT 1 FROM public.alerts alert JOIN public.club_alert_rules rule
          ON rule.club_id=alert.club_id AND rule.rule_key=alert.rule_key AND rule.version=alert.rule_version
        WHERE alert.id=e.entity_id AND alert.club_id=e.club_id AND alert.resolved_at IS NULL AND alert.archived_at IS NULL
          AND rule.enabled AND public.is_athlete_module_enabled(alert.athlete_id,public.module_key_for_notification_type(alert.type))
          AND (alert.type NOT IN ('absence','competition','charge') OR public.is_athlete_module_enabled(alert.athlete_id,'planning'))
          AND (alert.type<>'charge' OR public.is_athlete_module_enabled(alert.athlete_id,'session_feedback'))
      ))
    ORDER BY e.id FOR UPDATE OF e SKIP LOCKED LIMIT 20
  )
  UPDATE public.push_event_outbox e SET claimed_at=clock_timestamp(),attempts=attempts+1,
    user_ids=CASE WHEN e.event_type IN ('rule_wellness','rule_feedback','rule_competition','rule_load') THEN
      ARRAY(SELECT staff.id FROM public.users staff JOIN public.alerts alert ON alert.id=e.entity_id
        WHERE staff.club_id=e.club_id AND (staff.role='head_coach' OR (staff.role='coach' AND alert.recipient_scope='staff')) ORDER BY staff.id)
      ELSE e.user_ids END
  FROM candidates c WHERE e.id=c.id RETURNING e.*;
$$;
COMMIT;
