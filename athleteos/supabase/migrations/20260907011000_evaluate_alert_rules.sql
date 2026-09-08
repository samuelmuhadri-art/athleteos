BEGIN;

-- Only the server can change a generated alert's factual snapshot.
CREATE FUNCTION public.protect_generated_alert() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.rule_key IS NOT NULL AND auth.role()='authenticated'
    AND (to_jsonb(NEW)-ARRAY['is_read','resolved_at','resolved_by','archived_at','archived_by'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['is_read','resolved_at','resolved_by','archived_at','archived_by']) THEN
    RAISE EXCEPTION 'La provenance d’une alerte automatique est protégée.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_generated_alert BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.protect_generated_alert();
REVOKE ALL ON FUNCTION public.protect_generated_alert() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.evaluate_club_alert_rules(
  p_club_id integer DEFAULT NULL,
  p_as_of date DEFAULT (now() AT TIME ZONE 'Europe/Brussels')::date,
  p_dry_run boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_club integer := coalesce(p_club_id,public.get_my_club_id());
  r public.club_alert_rules%ROWTYPE; a record; s record; q public.wellness_questionnaire_versions%ROWTYPE;
  v_type text; v_module text; v_title text; v_description text; v_scope text;
  v_data jsonb; v_since date; v_last date; v_episode text; v_session integer;
  v_days integer; v_n integer; v_threshold integer; v_count integer; v_private boolean;
  v_value numeric; v_reference numeric; v_variation numeric; v_id integer;
  v_generated integer := 0; v_candidates integer := 0;
  v_active_days smallint[]; v_questions jsonb;
BEGIN
  IF v_club IS NULL OR p_as_of IS NULL OR p_dry_run IS NULL THEN RAISE EXCEPTION 'Paramètres invalides.'; END IF;
  IF coalesce(auth.role(),'') <> 'service_role' THEN
    IF public.get_my_role() IS NULL OR public.get_my_role() NOT IN ('head_coach','coach')
      OR v_club IS DISTINCT FROM public.get_my_club_id()
      OR p_as_of IS DISTINCT FROM (now() AT TIME ZONE 'Europe/Brussels')::date THEN
      RAISE EXCEPTION 'Action non autorisée.' USING ERRCODE='42501';
    END IF;
  END IF;
  -- Concurrent dashboard/cron invocations serialize, including insertion into the existing outbox.
  PERFORM pg_advisory_xact_lock(70907,v_club);
  SELECT * INTO q FROM public.wellness_questionnaire_versions WHERE club_id=v_club AND is_active;
  v_active_days := coalesce(q.active_days,ARRAY[1,2,3,4,5,6,7]::smallint[]);
  v_questions := coalesce(q.questions,public.default_wellness_questions());
  FOR r IN SELECT * FROM public.club_alert_rules WHERE club_id=v_club AND enabled LOOP
    v_type := CASE WHEN r.rule_key IN ('wellness_missing','sleep_low','soreness_high') THEN 'wellness'
      WHEN r.rule_key IN ('feedback_missing','rpe_missing') THEN 'absence'
      WHEN r.rule_key='competition_unplanned' THEN 'competition' ELSE 'charge' END;
    v_module := public.module_key_for_notification_type(v_type);
    FOR a IN SELECT id,name FROM public.athletes WHERE club_id=v_club
      AND (r.target_group IS NULL OR group_name=r.target_group)
      AND public.is_athlete_module_enabled(id,v_module)
    LOOP
      v_data:=NULL; v_since:=NULL; v_episode:=NULL; v_session:=NULL;
      v_scope:=r.recipient_scope;
      IF r.rule_key='wellness_missing' THEN
        -- Count only completed requested days since activation (never today's unfinished day).
        SELECT max(date) INTO v_last FROM public.athlete_wellness WHERE athlete_id=a.id AND date<p_as_of;
        SELECT count(*),min(day::date) INTO v_count,v_since
        FROM generate_series(greatest(coalesce(v_last+1,(r.updated_at AT TIME ZONE 'Europe/Brussels')::date),
          (r.updated_at AT TIME ZONE 'Europe/Brussels')::date,
          coalesce((q.created_at AT TIME ZONE 'Europe/Brussels')::date,(r.updated_at AT TIME ZONE 'Europe/Brussels')::date))::timestamp,
          (p_as_of-1)::timestamp,interval '1 day') day
        WHERE extract(isodow FROM day)::integer=ANY(v_active_days);
        -- A response today closes the missing-response episode immediately.
        IF v_count >= (r.parameters->>'days')::integer AND NOT EXISTS(
          SELECT 1 FROM public.athlete_wellness WHERE athlete_id=a.id AND date=p_as_of
        ) THEN
          v_title:='Wellness non renseigné';
          v_description:=format('%s : aucune réponse depuis %s jours demandés (seuil : %s).',a.name,v_count,r.parameters->>'days');
          v_episode:=v_since::text;
          v_data:=jsonb_build_object('missingRequestedDays',v_count,'lastResponse',v_last);
          IF q.response_visibility='head_coach' THEN v_scope:='head_coach'; END IF;
        END IF;
      ELSIF r.rule_key IN ('sleep_low','soreness_high') THEN
        v_title:=CASE WHEN r.rule_key='sleep_low' THEN 'Sommeil sous le seuil' ELSE 'Courbatures au-dessus du seuil' END;
        v_n:=(r.parameters->>'consecutiveResponses')::integer;
        v_threshold:=(r.parameters->>'threshold')::integer;
        IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_questions) item
          WHERE item->>'key'=CASE WHEN r.rule_key='sleep_low' THEN 'sleep' ELSE 'soreness' END) THEN CONTINUE; END IF;
        -- A missing optional answer breaks a streak; it is never interpreted as a zero.
        SELECT max(w.date) INTO v_last FROM public.athlete_wellness w WHERE w.athlete_id=a.id AND w.date<=p_as_of
          AND CASE WHEN r.rule_key='sleep_low' THEN w.sleep IS NULL OR w.sleep>v_threshold
            ELSE w.soreness IS NULL OR w.soreness<v_threshold END;
        SELECT count(*),min(w.date),max(w.date),bool_or(coalesce(version.response_visibility,'staff')='head_coach'),
          jsonb_agg(jsonb_build_object('date',w.date,'value',CASE WHEN r.rule_key='sleep_low' THEN w.sleep ELSE w.soreness END) ORDER BY w.date)
        INTO v_count,v_since,v_last,v_private,v_data
        FROM (SELECT * FROM public.athlete_wellness WHERE athlete_id=a.id AND date<=p_as_of
          AND date>coalesce(v_last,'0001-01-01'::date) ORDER BY date DESC LIMIT v_n) w
        LEFT JOIN public.wellness_questionnaire_versions version ON version.id=w.questionnaire_version_id;
        IF v_count=v_n AND v_last>=p_as_of-7 AND v_since>=p_as_of-14 THEN
          -- Earliest date in this episode is stable even as new responses arrive.
          SELECT min(w.date) INTO v_since FROM public.athlete_wellness w WHERE w.athlete_id=a.id AND w.date<=p_as_of
            AND w.date>coalesce((SELECT max(b.date) FROM public.athlete_wellness b WHERE b.athlete_id=a.id AND b.date<=p_as_of
              AND CASE WHEN r.rule_key='sleep_low' THEN b.sleep IS NULL OR b.sleep>v_threshold ELSE b.soreness IS NULL OR b.soreness<v_threshold END),'0001-01-01');
          v_description:=format('%s : %s réponses successives %s %s/5.',a.name,v_n,
            CASE WHEN r.rule_key='sleep_low' THEN 'inférieures ou égales à' ELSE 'supérieures ou égales à' END,v_threshold);
          v_episode:=v_since::text;
          v_data:=jsonb_build_object('responses',v_data);
          IF v_private OR EXISTS(SELECT 1 FROM public.athlete_wellness w
            JOIN public.wellness_questionnaire_versions version ON version.id=w.questionnaire_version_id
            WHERE w.athlete_id=a.id AND w.date BETWEEN v_since AND p_as_of AND version.response_visibility='head_coach'
          ) THEN v_scope:='head_coach'; END IF;
        ELSE v_data:=NULL;
        END IF;
      ELSIF r.rule_key IN ('feedback_missing','rpe_missing') THEN
        IF NOT public.is_athlete_module_enabled(a.id,'planning') THEN CONTINUE; END IF;
        v_days:=(r.parameters->>'daysAfter')::integer;
        -- Only confirmed participation, not absent/cancelled/unconfirmed sessions.
        SELECT session.id,session.title,session.session_date INTO s
        FROM public.session_athletes sa JOIN public.sessions session ON session.id=sa.session_id
        WHERE sa.athlete_id=a.id AND session.club_id=v_club AND session.lifecycle_status<>'cancelled'
          AND sa.status IN ('done','partial') AND session.session_date BETWEEN p_as_of-30 AND p_as_of-v_days
          AND CASE WHEN r.rule_key='rpe_missing' THEN sa.rpe IS NULL ELSE sa.feedback_submitted_at IS NULL END
        ORDER BY session.session_date,session.id LIMIT 1;
        IF FOUND THEN
          v_since:=s.session_date; v_session:=s.id; v_episode:='session-'||s.id;
          v_title:=CASE WHEN r.rule_key='rpe_missing' THEN 'RPE manquant' ELSE 'Feedback de séance manquant' END;
          v_description:=format('%s : %s pour « %s » du %s, après le délai de %s jour(s).',a.name,lower(v_title),s.title,s.session_date,v_days);
          v_data:=jsonb_build_object('sessionId',s.id,'sessionDate',s.session_date);
        END IF;
      ELSIF r.rule_key='competition_unplanned' THEN
        IF NOT public.is_athlete_module_enabled(a.id,'planning') THEN CONTINUE; END IF;
        SELECT competition.id,competition.name,competition.date,
          (SELECT count(*) FROM public.session_athletes sa JOIN public.sessions session ON session.id=sa.session_id
            WHERE sa.athlete_id=a.id AND session.club_id=v_club AND session.lifecycle_status<>'cancelled'
              AND session.session_date>=p_as_of AND session.session_date<competition.date) planned
        INTO s FROM public.competition_athletes ca JOIN public.competitions competition ON competition.id=ca.competition_id
        WHERE ca.athlete_id=a.id AND competition.club_id=v_club
          AND competition.date BETWEEN p_as_of AND p_as_of+(r.parameters->>'daysBefore')::integer
        ORDER BY competition.date,competition.id LIMIT 1;
        IF FOUND AND s.planned<(r.parameters->>'minimumPlannedSessions')::integer THEN
          v_since:=p_as_of; v_episode:='competition-'||s.id;
          v_title:='Compétition proche : planning à vérifier';
          v_description:=format('%s : %s séance(s) planifiée(s) avant « %s » du %s (minimum configuré : %s).',a.name,s.planned,s.name,s.date,r.parameters->>'minimumPlannedSessions');
          v_data:=jsonb_build_object('competitionId',s.id,'competitionDate',s.date,'plannedSessions',s.planned);
        END IF;
      ELSIF r.rule_key='load_variation' THEN
        IF NOT public.is_athlete_module_enabled(a.id,'planning') OR NOT public.is_athlete_module_enabled(a.id,'session_feedback') THEN CONTINUE; END IF;
        v_n:=(r.parameters->>'comparisonWeeks')::integer; v_since:=p_as_of-7;
        -- Every calendar day must be complete or explicitly confirmed as rest.
        WITH session_days AS (
          SELECT session.session_date AS load_day,
            CASE WHEN bool_and(coalesce(sa.status='none',false) OR (sa.rpe IS NOT NULL AND sa.actual_duration_minutes IS NOT NULL AND coalesce(sa.duration_source='reported',false)))
              THEN sum(CASE WHEN sa.status='none' THEN 0 ELSE sa.rpe*sa.actual_duration_minutes END) END AS load
          FROM public.session_athletes sa JOIN public.sessions session ON session.id=sa.session_id
          WHERE sa.athlete_id=a.id AND session.club_id=v_club AND session.lifecycle_status<>'cancelled'
            AND session.session_date BETWEEN p_as_of-7*(v_n+1) AND p_as_of-1 GROUP BY session.session_date
        ), days AS (
          SELECT d.load_day::date AS load_day,CASE WHEN sd.load_day IS NOT NULL THEN sd.load WHEN rest.athlete_id IS NOT NULL THEN 0 END AS load
          FROM generate_series((p_as_of-7*(v_n+1))::timestamp,(p_as_of-1)::timestamp,interval '1 day') d(load_day)
          LEFT JOIN session_days sd ON sd.load_day=d.load_day::date
          LEFT JOIN public.athlete_daily_load_days rest ON rest.athlete_id=a.id AND rest.load_date=d.load_day::date
        ) SELECT count(load),sum(load) FILTER(WHERE load_day>=p_as_of-7),sum(load) FILTER(WHERE load_day<p_as_of-7)/v_n::numeric
          INTO v_count,v_value,v_reference FROM days;
        IF v_count=7*(v_n+1) AND v_reference>0 THEN
          v_variation:=round(100*(v_value-v_reference)/v_reference,1);
          IF abs(v_variation)>=(r.parameters->>'percent')::integer THEN
            v_episode:=to_char(p_as_of,'IYYY-IW'); v_title:='Variation de charge observée';
            v_description:=format('%s : variation de %s%% sur 7 jours (%s UA, référence %s UA sur %s semaines).',a.name,v_variation,v_value,round(v_reference,1),v_n);
            v_data:=jsonb_build_object('load',v_value,'reference',v_reference,'variationPercent',v_variation);
          END IF;
        END IF;
      END IF;
      IF v_data IS NULL OR v_episode IS NULL THEN CONTINUE; END IF;
      v_candidates:=v_candidates+1;
      IF p_dry_run THEN CONTINUE; END IF;
      INSERT INTO public.alerts(club_id,athlete_id,session_id,type,title,description,severity,dedupe_key,rule_key,rule_version,trigger_data,recipient_scope)
      VALUES(v_club,a.id,v_session,v_type,v_title,v_description,r.severity,
        'rule:'||r.rule_key||':'||r.version||':'||a.id||':'||v_episode,r.rule_key,r.version,
        v_data||jsonb_build_object('since',v_since,'evaluatedOn',p_as_of,'parameters',r.parameters,'targetGroup',r.target_group,'moduleKey',v_module),v_scope)
      ON CONFLICT(club_id,type,dedupe_key) DO NOTHING RETURNING id INTO v_id;
      IF v_id IS NOT NULL THEN v_generated:=v_generated+1; END IF;
    END LOOP;
  END LOOP;
  -- Never return health observations/counts to a coach with a restricted questionnaire.
  RETURN jsonb_build_object('ok',true,'dryRun',p_dry_run,'generated',
    CASE WHEN auth.role()='service_role' OR public.get_my_role()='head_coach' THEN v_generated ELSE NULL END,
    'candidates',CASE WHEN auth.role()='service_role' OR public.get_my_role()='head_coach' THEN v_candidates ELSE NULL END);
END;
$$;
REVOKE ALL ON FUNCTION public.evaluate_club_alert_rules(integer,date,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_club_alert_rules(integer,date,boolean) TO authenticated, service_role;

COMMIT;
