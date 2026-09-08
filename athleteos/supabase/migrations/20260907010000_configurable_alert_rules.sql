BEGIN;

CREATE TABLE public.club_alert_rules (
  club_id integer NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  rule_key text NOT NULL CHECK (rule_key IN ('wellness_missing','sleep_low','soreness_high','feedback_missing','rpe_missing','competition_unplanned','load_variation')),
  enabled boolean NOT NULL DEFAULT false,
  parameters jsonb NOT NULL CHECK (jsonb_typeof(parameters) = 'object'),
  target_group text CHECK (length(target_group) BETWEEN 1 AND 120),
  severity text NOT NULL DEFAULT 'modérée' CHECK (severity IN ('info','légère','modérée','critique')),
  recipient_scope text NOT NULL DEFAULT 'staff' CHECK (recipient_scope IN ('staff','head_coach')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, rule_key)
);
ALTER TABLE public.club_alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY club_alert_rules_staff_read ON public.club_alert_rules FOR SELECT TO authenticated
  USING (club_id = public.get_my_club_id() AND public.get_my_role() IN ('head_coach','coach'));
REVOKE ALL ON public.club_alert_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.club_alert_rules TO authenticated;
GRANT ALL ON public.club_alert_rules TO service_role;

ALTER TABLE public.alerts
  ADD COLUMN rule_key text,
  ADD COLUMN rule_version integer,
  ADD COLUMN trigger_data jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN recipient_scope text NOT NULL DEFAULT 'staff' CHECK (recipient_scope IN ('staff','head_coach'));

-- Restrictive policies also apply alongside the historical club policy.
CREATE POLICY alerts_recipient_read ON public.alerts AS RESTRICTIVE FOR SELECT TO authenticated
  USING (rule_key IS NULL OR (public.get_my_role() IN ('head_coach','coach')
    AND (recipient_scope = 'staff' OR public.get_my_role() = 'head_coach')));
CREATE POLICY alerts_recipient_update ON public.alerts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (rule_key IS NULL OR (public.get_my_role() IN ('head_coach','coach')
    AND (recipient_scope = 'staff' OR public.get_my_role() = 'head_coach')));
CREATE POLICY alerts_generated_no_delete ON public.alerts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (rule_key IS NULL);

-- Client writes retain the legacy columns; provenance/recipients are server-owned.
REVOKE INSERT, UPDATE ON public.alerts FROM authenticated;
GRANT INSERT (club_id,athlete_id,type,title,description,severity,is_read,created_at,session_id,dedupe_key) ON public.alerts TO authenticated;
GRANT UPDATE (club_id,athlete_id,type,title,description,severity,is_read,created_at,session_id,dedupe_key,resolved_at,resolved_by,archived_at,archived_by) ON public.alerts TO authenticated;

CREATE FUNCTION public.get_club_alert_rules() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF public.get_my_club_id() IS NULL OR coalesce(public.get_my_role(),'') NOT IN ('head_coach','coach') THEN
    RAISE EXCEPTION 'Action non autorisée.' USING ERRCODE='42501';
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('key',rule_key,'enabled',enabled,
    'parameters',parameters,'targetGroup',target_group,'severity',severity,
    'recipientScope',recipient_scope,'version',version) ORDER BY rule_key),'[]')
    FROM public.club_alert_rules WHERE club_id=public.get_my_club_id());
END;
$$;

CREATE FUNCTION public.configure_club_alert_rules(p_rules jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_club integer := public.get_my_club_id();
  r jsonb; k text; p jsonb; f text; allowed text[]; lower_bound integer; upper_bound integer; n numeric;
BEGIN
  IF v_club IS NULL OR public.get_my_role() IS DISTINCT FROM 'head_coach' THEN
    RAISE EXCEPTION 'Seul le responsable du club configure les alertes.' USING ERRCODE='42501';
  END IF;
  IF p_rules IS NULL OR jsonb_typeof(p_rules) <> 'array' THEN RAISE EXCEPTION 'Liste de règles invalide.'; END IF;
  IF jsonb_array_length(p_rules) NOT BETWEEN 1 AND 7 THEN RAISE EXCEPTION 'Une à sept règles attendues.'; END IF;
  IF (SELECT count(*) <> count(DISTINCT item->>'key') FROM jsonb_array_elements(p_rules) item) THEN
    RAISE EXCEPTION 'Règle dupliquée ou sans clé.';
  END IF;
  PERFORM 1 FROM public.clubs WHERE id=v_club FOR UPDATE;
  FOR r IN SELECT value FROM jsonb_array_elements(p_rules) LOOP
    k := r->>'key'; p := r->'parameters';
    allowed := CASE k WHEN 'wellness_missing' THEN ARRAY['days']
      WHEN 'sleep_low' THEN ARRAY['threshold','consecutiveResponses']
      WHEN 'soreness_high' THEN ARRAY['threshold','consecutiveResponses']
      WHEN 'feedback_missing' THEN ARRAY['daysAfter'] WHEN 'rpe_missing' THEN ARRAY['daysAfter']
      WHEN 'competition_unplanned' THEN ARRAY['daysBefore','minimumPlannedSessions']
      WHEN 'load_variation' THEN ARRAY['percent','comparisonWeeks'] END;
    IF allowed IS NULL OR jsonb_typeof(p) IS DISTINCT FROM 'object'
      OR jsonb_typeof(r->'enabled') IS DISTINCT FROM 'boolean'
      OR coalesce(r->>'severity','') NOT IN ('info','légère','modérée','critique')
      OR coalesce(r->>'recipientScope','') NOT IN ('staff','head_coach') THEN
      RAISE EXCEPTION 'Configuration de règle invalide.';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p) name WHERE NOT name=ANY(allowed)) THEN
      RAISE EXCEPTION 'Paramètre inconnu.';
    END IF;
    FOREACH f IN ARRAY allowed LOOP
      lower_bound := CASE WHEN f='percent' THEN 10 WHEN f='comparisonWeeks' THEN 2
        WHEN f='threshold' AND k='soreness_high' THEN 2 ELSE 1 END;
      upper_bound := CASE f WHEN 'days' THEN 14 WHEN 'consecutiveResponses' THEN 7
        WHEN 'daysAfter' THEN 7 WHEN 'daysBefore' THEN 42 WHEN 'minimumPlannedSessions' THEN 10
        WHEN 'percent' THEN 100 WHEN 'comparisonWeeks' THEN 6
        WHEN 'threshold' THEN CASE WHEN k='sleep_low' THEN 4 ELSE 5 END END;
      IF jsonb_typeof(p->f) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Valeur numérique attendue : %.',f; END IF;
      n := (p->>f)::numeric;
      IF n <> trunc(n) OR n NOT BETWEEN lower_bound AND upper_bound THEN
        RAISE EXCEPTION 'Valeur hors limites : %.',f;
      END IF;
    END LOOP;
    IF r->>'targetGroup' IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.athletes WHERE club_id=v_club AND group_name=r->>'targetGroup'
    ) THEN RAISE EXCEPTION 'Groupe introuvable dans ce club.'; END IF;
    INSERT INTO public.club_alert_rules(club_id,rule_key,enabled,parameters,target_group,severity,recipient_scope)
    VALUES(v_club,k,(r->>'enabled')::boolean,p,r->>'targetGroup',r->>'severity',r->>'recipientScope')
    ON CONFLICT(club_id,rule_key) DO UPDATE SET enabled=excluded.enabled,parameters=excluded.parameters,
      target_group=excluded.target_group,severity=excluded.severity,recipient_scope=excluded.recipient_scope,
      version=club_alert_rules.version+1,updated_at=now()
    WHERE (club_alert_rules.enabled,club_alert_rules.parameters,club_alert_rules.target_group,club_alert_rules.severity,club_alert_rules.recipient_scope)
      IS DISTINCT FROM (excluded.enabled,excluded.parameters,excluded.target_group,excluded.severity,excluded.recipient_scope);
  END LOOP;
  RETURN public.get_club_alert_rules();
END;
$$;

-- Keep personal reads and shared lifecycle, with the same recipient check as RLS.
CREATE OR REPLACE FUNCTION public.mark_alerts_read(p_alert_ids integer[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user integer := public.get_my_user_id(); v_count integer;
BEGIN
  IF v_user IS NULL OR coalesce(public.get_my_role(),'') NOT IN ('head_coach','coach') THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  INSERT INTO public.alert_read_states(alert_id,user_id,read_at)
    SELECT id,v_user,now() FROM public.alerts WHERE id=ANY(coalesce(p_alert_ids,'{}'))
      AND club_id=public.get_my_club_id() AND (recipient_scope='staff' OR public.get_my_role()='head_coach')
    ON CONFLICT(alert_id,user_id) DO UPDATE SET read_at=excluded.read_at;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  UPDATE public.alerts SET is_read=true WHERE id=ANY(coalesce(p_alert_ids,'{}'))
    AND club_id=public.get_my_club_id() AND (recipient_scope='staff' OR public.get_my_role()='head_coach');
  RETURN v_count;
END;
$$;
CREATE OR REPLACE FUNCTION public.set_alert_resolution(p_alert_id integer,p_resolved boolean,p_archived boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user integer := public.get_my_user_id();
BEGIN
  IF v_user IS NULL OR coalesce(public.get_my_role(),'') NOT IN ('head_coach','coach') THEN RAISE EXCEPTION 'Action non autorisée.'; END IF;
  UPDATE public.alerts SET
    resolved_at=CASE WHEN p_resolved THEN coalesce(resolved_at,now()) ELSE NULL END,
    resolved_by=CASE WHEN p_resolved THEN coalesce(resolved_by,v_user) ELSE NULL END,
    archived_at=CASE WHEN p_archived THEN coalesce(archived_at,now()) ELSE NULL END,
    archived_by=CASE WHEN p_archived THEN coalesce(archived_by,v_user) ELSE NULL END
  WHERE id=p_alert_id AND club_id=public.get_my_club_id()
    AND (recipient_scope='staff' OR public.get_my_role()='head_coach');
  IF NOT FOUND THEN RAISE EXCEPTION 'Alerte introuvable.'; END IF;
  RETURN jsonb_build_object('alertId',p_alert_id,'resolved',p_resolved,'archived',p_archived);
END;
$$;

REVOKE ALL ON FUNCTION public.get_club_alert_rules(),public.configure_club_alert_rules(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_club_alert_rules(),public.configure_club_alert_rules(jsonb) TO authenticated;

COMMIT;
