BEGIN;

-- ============================================================
-- Tâche 12 (suite) — les 3 RPC de compétition (tâche 14) renseignent
-- désormais les colonnes canoniques ajoutées par la migration
-- précédente sur les NOUVELLES lignes qu'elles écrivent.
--
-- p_event est déjà l'identifiant canonique de discipline au moment où
-- ces fonctions le reçoivent (résolu côté client via resolveDisciplineId,
-- tâche 9, avant l'appel RPC — voir Competitions.jsx/AthletePerfs.jsx) :
-- pas besoin d'un nouveau paramètre, discipline_id = p_event directement.
-- p_result_value est déjà validé non NULL avant d'atteindre l'écriture
-- (RAISE EXCEPTION 'Résultat non interprétable' sinon) : les nouvelles
-- lignes ont donc toujours une valeur canonique valide, quality_flags
-- reste '{}' par défaut — ce marquage ne concerne que les anciennes
-- données réparées par le backfill précédent.
--
-- Seule l'unité manquait côté serveur (le registre de disciplines est
-- JS-only, tâche 9) : ajoutée en paramètre p_unit, calculée côté client
-- via getDisciplineUnit(), avec DEFAULT NULL pour rester compatible si
-- le déploiement frontend/Supabase n'est pas parfaitement synchronisé.
--
-- CREATE OR REPLACE avec UNIQUEMENT des paramètres additionnels à
-- valeur par défaut en fin de liste : remplace bien la même fonction
-- (même OID, mêmes grants), ne crée pas une surcharge séparée.
-- ============================================================

CREATE OR REPLACE FUNCTION public._apply_competition_result(
  p_competition_id  integer,
  p_athlete_id      integer,
  p_club_id         integer,
  p_athlete_name    text,
  p_event           text,
  p_result          text,
  p_result_value    numeric,
  p_higher_is_better boolean,
  p_context         text,
  p_competition_name text,
  p_also_log_performance boolean,
  p_performance_date date,
  p_breakdown       jsonb DEFAULT NULL,
  p_unit            text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result_id      integer;
  v_performance_id integer;
  v_existing_pr    numeric;
  v_existing_sb    numeric;
  v_is_pr          boolean;
  v_is_sb          boolean;
  v_record_id      integer;
  v_outbox         jsonb := '[]'::jsonb;
  v_outbox_id      bigint;
  v_outbox_payload jsonb;
  v_this_year      boolean;
BEGIN
  INSERT INTO competition_results (competition_id, athlete_id, event, result, context, result_value, unit, discipline_id)
  VALUES (p_competition_id, p_athlete_id, p_event, p_result, p_context, p_result_value, p_unit, p_event)
  RETURNING id INTO v_result_id;

  IF p_also_log_performance THEN
    INSERT INTO athlete_performances (athlete_id, club_id, discipline, discipline_type, value, performance_date, context, breakdown, normalized_value, unit, discipline_id)
    VALUES (p_athlete_id, p_club_id, p_event, p_event, p_result, p_performance_date, p_competition_name, p_breakdown, p_result_value, p_unit, p_event)
    RETURNING id INTO v_performance_id;
  END IF;

  v_this_year := date_part('year', p_performance_date) = date_part('year', now());

  INSERT INTO records (athlete_id, discipline, pr, pr_value, pr_date, sb, sb_value, unit, discipline_id)
  VALUES (p_athlete_id, p_event, p_result, p_result_value, p_performance_date, p_result, p_result_value, p_unit, p_event)
  ON CONFLICT (athlete_id, discipline) DO NOTHING
  RETURNING id INTO v_record_id;

  IF v_record_id IS NOT NULL THEN
    v_is_pr := true;
    v_is_sb := v_this_year;
  ELSE
    SELECT id, pr_value, sb_value INTO v_record_id, v_existing_pr, v_existing_sb
    FROM records WHERE athlete_id = p_athlete_id AND discipline = p_event
    FOR UPDATE;

    v_is_pr := v_existing_pr IS NULL OR (p_higher_is_better AND p_result_value > v_existing_pr) OR (NOT p_higher_is_better AND p_result_value < v_existing_pr);
    v_is_sb := v_this_year AND (v_existing_sb IS NULL OR (p_higher_is_better AND p_result_value > v_existing_sb) OR (NOT p_higher_is_better AND p_result_value < v_existing_sb));

    IF v_is_pr OR v_is_sb THEN
      UPDATE records SET
        pr           = CASE WHEN v_is_pr THEN p_result ELSE pr END,
        pr_value     = CASE WHEN v_is_pr THEN p_result_value ELSE pr_value END,
        pr_date      = CASE WHEN v_is_pr THEN p_performance_date ELSE pr_date END,
        sb           = CASE WHEN v_is_sb THEN p_result ELSE sb END,
        sb_value     = CASE WHEN v_is_sb THEN p_result_value ELSE sb_value END,
        unit         = coalesce(p_unit, unit),
        discipline_id = coalesce(discipline_id, p_event)
      WHERE id = v_record_id;
    END IF;
  END IF;

  IF v_is_pr THEN
    INSERT INTO notification_outbox (club_id, athlete_id, event_type, payload)
    VALUES (p_club_id, p_athlete_id, 'competition_new_record',
      jsonb_build_object('clubId', p_club_id, 'athleteId', p_athlete_id, 'athleteName', p_athlete_name,
        'discipline', p_event, 'result', p_result, 'competitionName', p_competition_name))
    RETURNING id, payload INTO v_outbox_id, v_outbox_payload;
    v_outbox := v_outbox || jsonb_build_object('outboxId', v_outbox_id, 'type', 'competition_new_record', 'payload', v_outbox_payload);
  END IF;

  INSERT INTO notification_outbox (club_id, athlete_id, event_type, payload)
  VALUES (p_club_id, p_athlete_id, 'competition_result_added',
    jsonb_build_object('clubId', p_club_id, 'athleteId', p_athlete_id, 'athleteName', p_athlete_name,
      'discipline', p_event, 'result', p_result, 'competitionName', p_competition_name))
  RETURNING id, payload INTO v_outbox_id, v_outbox_payload;
  v_outbox := v_outbox || jsonb_build_object('outboxId', v_outbox_id, 'type', 'competition_result_added', 'payload', v_outbox_payload);

  RETURN jsonb_build_object(
    'resultId', v_result_id, 'performanceId', v_performance_id, 'isNewRecord', v_is_pr,
    'recordId', v_record_id, 'notifications', v_outbox
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_competition_result(
  p_competition_id   integer,
  p_athlete_id       integer,
  p_event            text,
  p_result           text,
  p_result_value     numeric,
  p_higher_is_better boolean,
  p_context          text DEFAULT NULL,
  p_idempotency_key  text DEFAULT NULL,
  p_unit             text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id  integer;
  v_club_id    integer;
  v_role       text;
  v_cached     jsonb;
  v_comp       record;
  v_athlete    record;
  v_result     jsonb;
BEGIN
  SELECT id, club_id, role INTO v_caller_id, v_club_id, v_role
  FROM users WHERE lower(trim(auth_uid)) = lower(trim(auth.uid()::text)) LIMIT 1;
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Profil introuvable.'; END IF;
  IF v_role NOT IN ('head_coach', 'coach') THEN RAISE EXCEPTION 'Action réservée au coach.'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT result INTO v_cached FROM rpc_idempotency
    WHERE fn_name = 'add_competition_result' AND idempotency_key = p_idempotency_key;
    IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  END IF;

  IF p_event IS NULL OR btrim(p_event) = '' THEN RAISE EXCEPTION 'Discipline manquante.'; END IF;
  IF p_result IS NULL OR btrim(p_result) = '' THEN RAISE EXCEPTION 'Résultat manquant.'; END IF;
  IF p_result_value IS NULL THEN RAISE EXCEPTION 'Résultat non interprétable.'; END IF;

  SELECT id, name, date, club_id INTO v_comp FROM competitions WHERE id = p_competition_id;
  IF v_comp.id IS NULL OR v_comp.club_id <> v_club_id THEN RAISE EXCEPTION 'Compétition introuvable dans ton club.'; END IF;

  SELECT id, name, club_id INTO v_athlete FROM athletes WHERE id = p_athlete_id;
  IF v_athlete.id IS NULL OR v_athlete.club_id <> v_club_id THEN RAISE EXCEPTION 'Athlète introuvable dans ton club.'; END IF;

  v_result := _apply_competition_result(
    p_competition_id, p_athlete_id, v_club_id, v_athlete.name, p_event, p_result, p_result_value,
    p_higher_is_better, p_context, v_comp.name, false, v_comp.date, NULL, p_unit
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO rpc_idempotency (fn_name, idempotency_key, actor_user_id, result)
    VALUES ('add_competition_result', p_idempotency_key, v_caller_id, v_result)
    ON CONFLICT (fn_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_solo_competition_result(
  p_name             text,
  p_date             date,
  p_location         text,
  p_type             text,
  p_event            text,
  p_result           text,
  p_result_value     numeric,
  p_higher_is_better boolean,
  p_context          text DEFAULT NULL,
  p_idempotency_key  text DEFAULT NULL,
  p_breakdown        jsonb DEFAULT NULL,
  p_unit             text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id     integer;
  v_club_id       integer;
  v_my_athlete_id integer;
  v_my_name       text;
  v_cached        jsonb;
  v_comp_id       integer;
  v_result        jsonb;
BEGIN
  SELECT id, club_id INTO v_caller_id, v_club_id
  FROM users WHERE lower(trim(auth_uid)) = lower(trim(auth.uid()::text)) LIMIT 1;
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Profil introuvable.'; END IF;

  SELECT id, name INTO v_my_athlete_id, v_my_name FROM athletes WHERE user_id = v_caller_id LIMIT 1;
  IF v_my_athlete_id IS NULL THEN RAISE EXCEPTION 'Profil athlète introuvable.'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT result INTO v_cached FROM rpc_idempotency
    WHERE fn_name = 'create_solo_competition_result' AND idempotency_key = p_idempotency_key;
    IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Nom de compétition manquant.'; END IF;
  IF p_date IS NULL THEN RAISE EXCEPTION 'Date manquante.'; END IF;
  IF p_event IS NULL OR btrim(p_event) = '' THEN RAISE EXCEPTION 'Discipline manquante.'; END IF;
  IF p_result IS NULL OR btrim(p_result) = '' THEN RAISE EXCEPTION 'Résultat manquant.'; END IF;
  IF p_result_value IS NULL THEN RAISE EXCEPTION 'Résultat non interprétable.'; END IF;

  INSERT INTO competitions (club_id, name, date, location, type)
  VALUES (v_club_id, btrim(p_name), p_date, nullif(btrim(coalesce(p_location, '')), ''), p_type)
  RETURNING id INTO v_comp_id;

  INSERT INTO competition_athletes (competition_id, athlete_id, planned_event)
  VALUES (v_comp_id, v_my_athlete_id, p_event);

  v_result := _apply_competition_result(
    v_comp_id, v_my_athlete_id, v_club_id, v_my_name, p_event, p_result, p_result_value,
    p_higher_is_better, p_context, btrim(p_name), true, p_date, p_breakdown, p_unit
  );
  v_result := v_result || jsonb_build_object('competitionId', v_comp_id);

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO rpc_idempotency (fn_name, idempotency_key, actor_user_id, result)
    VALUES ('create_solo_competition_result', p_idempotency_key, v_caller_id, v_result)
    ON CONFLICT (fn_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

-- Grants réaffirmés explicitement sur les nouvelles signatures (CREATE OR
-- REPLACE conserve normalement les grants existants sur le même OID, mais
-- on les réaffirme ici pour ne rien laisser au hasard, comme pour les
-- fonctions déjà corrigées à la tâche 14).
REVOKE ALL ON FUNCTION public._apply_competition_result(integer, integer, integer, text, text, text, numeric, boolean, text, text, boolean, date, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_competition_result(integer, integer, text, text, numeric, boolean, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_solo_competition_result(text, date, text, text, text, text, numeric, boolean, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_competition_result(integer, integer, text, text, numeric, boolean, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_solo_competition_result(text, date, text, text, text, text, numeric, boolean, text, text, jsonb, text) TO authenticated;

COMMIT;
