BEGIN;

CREATE OR REPLACE FUNCTION public.get_wellness_questionnaire(p_date date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_club_id integer := public.get_my_club_id();
  v_athlete_id integer := public.get_my_athlete_id();
  v_has_response boolean := false;
  v_response_version_id bigint;
  v_version public.wellness_questionnaire_versions%ROWTYPE;
BEGIN
  IF v_club_id IS NULL OR public.get_my_role() NOT IN ('head_coach', 'coach', 'athlete') THEN
    RAISE EXCEPTION 'Action non autorisee.';
  END IF;

  IF v_athlete_id IS NOT NULL THEN
    SELECT true, questionnaire_version_id INTO v_has_response, v_response_version_id
    FROM public.athlete_wellness
    WHERE athlete_id = v_athlete_id AND date = p_date;
  END IF;

  -- Une ligne historique sans version appartient définitivement au preset V1,
  -- même si le club active ensuite un autre questionnaire le même jour.
  IF v_has_response AND v_response_version_id IS NULL THEN
    RETURN jsonb_build_object(
      'versionId', null,
      'versionNumber', 1,
      'questions', public.default_wellness_questions(),
      'activeDays', to_jsonb(ARRAY[1,2,3,4,5,6,7]::smallint[]),
      'responseVisibility', 'staff',
      'isDefault', true
    );
  ELSIF v_response_version_id IS NOT NULL THEN
    SELECT * INTO v_version FROM public.wellness_questionnaire_versions
    WHERE id = v_response_version_id AND club_id = v_club_id;
  ELSE
    SELECT * INTO v_version FROM public.wellness_questionnaire_versions
    WHERE club_id = v_club_id AND is_active
    ORDER BY version_number DESC LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'versionId', null,
      'versionNumber', 1,
      'questions', public.default_wellness_questions(),
      'activeDays', to_jsonb(ARRAY[1,2,3,4,5,6,7]::smallint[]),
      'responseVisibility', 'staff',
      'isDefault', true
    );
  END IF;

  RETURN jsonb_build_object(
    'versionId', v_version.id,
    'versionNumber', v_version.version_number,
    'questions', v_version.questions,
    'activeDays', to_jsonb(v_version.active_days),
    'responseVisibility', v_version.response_visibility,
    'isDefault', false
  );
END;
$$;

COMMIT;
