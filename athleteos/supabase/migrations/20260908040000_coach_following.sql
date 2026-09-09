BEGIN;
-- Organisational assignments, not a new security perimeter. Existing club RLS
-- remains authoritative and unchanged. Defaults preserve existing clubs.
CREATE TABLE public.coach_following (
  coach_user_id bigint PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  club_id bigint NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'club' CHECK(mode IN ('club','assigned')),
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.coach_group_assignments (
  coach_user_id bigint NOT NULL REFERENCES public.coach_following(coach_user_id) ON DELETE CASCADE,
  group_name text NOT NULL CHECK(length(group_name) BETWEEN 1 AND 120),
  PRIMARY KEY(coach_user_id,group_name)
);
CREATE TABLE public.coach_athlete_assignments (
  coach_user_id bigint NOT NULL REFERENCES public.coach_following(coach_user_id) ON DELETE CASCADE,
  athlete_id bigint NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  PRIMARY KEY(coach_user_id,athlete_id)
);
ALTER TABLE public.coach_following ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_athlete_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_following,public.coach_group_assignments,public.coach_athlete_assignments FROM anon,authenticated;
GRANT ALL ON public.coach_following,public.coach_group_assignments,public.coach_athlete_assignments TO service_role;
-- No direct client writes or reads; scoped RPCs are the only client entry.

CREATE FUNCTION public.get_coach_following() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_caller public.users; v_coaches jsonb;
BEGIN
  SELECT * INTO v_caller FROM public.users WHERE auth_uid::text=auth.uid()::text;
  IF v_caller.id IS NULL OR v_caller.role NOT IN ('coach','head_coach') THEN
    RAISE EXCEPTION 'Accès réservé aux coachs' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',u.id,'name',u.name,'role',u.role,
    'mode',CASE WHEN u.role='head_coach' THEN 'club' ELSE coalesce(f.mode,'club') END,
    'revision',coalesce(f.revision,0),
    'groups',coalesce((SELECT jsonb_agg(g.group_name ORDER BY g.group_name) FROM public.coach_group_assignments g WHERE g.coach_user_id=f.coach_user_id),'[]'::jsonb),
    'athleteIds',coalesce((SELECT jsonb_agg(a.athlete_id) FROM public.coach_athlete_assignments a JOIN public.athletes t ON t.id=a.athlete_id AND t.club_id=v_caller.club_id WHERE a.coach_user_id=f.coach_user_id),'[]'::jsonb)
  ) ORDER BY u.name),'[]'::jsonb) INTO v_coaches
  FROM public.users u LEFT JOIN public.coach_following f ON f.coach_user_id=u.id AND f.club_id=u.club_id
  WHERE u.club_id=v_caller.club_id AND u.role IN ('coach','head_coach')
    AND (v_caller.role='head_coach' OR u.id=v_caller.id);
  RETURN jsonb_build_object('coaches',v_coaches,'athletes',coalesce((
    SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'group',group_name) ORDER BY name)
    FROM public.athletes WHERE club_id=v_caller.club_id),'[]'::jsonb));
END $$;

CREATE FUNCTION public.configure_coach_following(p_coach_user_id bigint,p_mode text,p_groups text[],p_athlete_ids bigint[],p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_caller public.users; v_target public.users; v_revision bigint;
BEGIN
  SELECT * INTO v_caller FROM public.users WHERE auth_uid::text=auth.uid()::text;
  IF v_caller.id IS NULL OR v_caller.role<>'head_coach' THEN
    RAISE EXCEPTION 'Seul le head coach organise les affectations' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_target FROM public.users WHERE id=p_coach_user_id FOR UPDATE;
  IF v_target.id IS NULL OR v_target.club_id<>v_caller.club_id OR v_target.role<>'coach' THEN
    RAISE EXCEPTION 'Coach introuvable dans ton club ou responsable global' USING ERRCODE='42501'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('club','assigned') OR p_groups IS NULL OR p_athlete_ids IS NULL
    OR cardinality(p_groups)>100 OR cardinality(p_athlete_ids)>2000
    OR EXISTS(SELECT 1 FROM unnest(p_groups) g WHERE g IS NULL OR length(g)>120 OR NOT EXISTS(SELECT 1 FROM public.athletes WHERE club_id=v_caller.club_id AND group_name=g))
    OR EXISTS(SELECT 1 FROM unnest(p_athlete_ids) a WHERE a IS NULL OR NOT EXISTS(SELECT 1 FROM public.athletes WHERE club_id=v_caller.club_id AND id=a))
  THEN RAISE EXCEPTION 'Groupes ou athlètes invalides : recharge la liste' USING ERRCODE='22023'; END IF;
  SELECT revision INTO v_revision FROM public.coach_following WHERE coach_user_id=v_target.id AND club_id=v_caller.club_id;
  IF p_expected_revision IS DISTINCT FROM coalesce(v_revision,0) THEN
    RAISE EXCEPTION 'Ces affectations ont changé. Recharge avant d’enregistrer.' USING ERRCODE='40001'; END IF;
  INSERT INTO public.coach_following(coach_user_id,club_id,mode,revision) VALUES(v_target.id,v_caller.club_id,p_mode,coalesce(v_revision,0)+1)
  ON CONFLICT(coach_user_id) DO UPDATE SET club_id=excluded.club_id,mode=excluded.mode,revision=excluded.revision,updated_at=now();
  DELETE FROM public.coach_group_assignments WHERE coach_user_id=v_target.id;
  DELETE FROM public.coach_athlete_assignments WHERE coach_user_id=v_target.id;
  IF p_mode='assigned' THEN
    INSERT INTO public.coach_group_assignments SELECT DISTINCT v_target.id,g FROM unnest(p_groups) g;
    INSERT INTO public.coach_athlete_assignments SELECT DISTINCT v_target.id,a FROM unnest(p_athlete_ids) a;
  END IF;
  INSERT INTO public.audit_logs(actor_user_id,actor_club_id,action,target_user_id,target_club_id,result,payload)
    VALUES(v_caller.id,v_caller.club_id,'configure_coach_following',v_target.id,v_caller.club_id,'success',jsonb_build_object('mode',p_mode,'groupCount',cardinality(p_groups),'athleteCount',cardinality(p_athlete_ids)));
  RETURN public.get_coach_following();
END $$;
REVOKE ALL ON FUNCTION public.get_coach_following(),public.configure_coach_following(bigint,text,text[],bigint[],bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_coach_following(),public.configure_coach_following(bigint,text,text[],bigint[],bigint) TO authenticated;
COMMIT;
