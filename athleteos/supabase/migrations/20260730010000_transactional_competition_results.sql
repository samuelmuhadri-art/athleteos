BEGIN;

-- ============================================================
-- Tâche 14 — compétitions et résultats transactionnels
--
-- Problème : Competitions.jsx (createCompetition/addResult) et
-- AthletePerfs.jsx (handleAddComp) écrivent en plusieurs `insert`/`update`
-- successifs depuis le client (compétition, puis lien athlète, puis
-- résultat, puis performance, puis record), sans aucune garantie
-- d'atomicité. Une panne réseau ou une erreur entre deux étapes laisse un
-- état incohérent (compétition sans participant, résultat sans mise à
-- jour de record, etc.) qu'il faut réparer à la main. Pire : dans
-- addResult, si la mise à jour du record échoue, l'erreur est juste
-- loguée (`console.error`) et le code continue quand même à envoyer les
-- notifications — exactement "notification envoyée alors que l'écriture
-- a échoué".
--
-- Un deuxième risque, non lié aux pannes : deux résultats battant le même
-- record soumis à quelques millisecondes d'écart (deux onglets, un
-- double-clic) peuvent tous les deux lire "pas de record existant" côté
-- client et écraser le travail l'un de l'autre sans jamais se voir.
--
-- Solution : 3 RPC SQL (SECURITY DEFINER, transaction implicite d'une
-- fonction Postgres — tout réussit ou rien n'est appliqué), avec
-- verrouillage de ligne (`FOR UPDATE`) sur `records` pour rendre la
-- comparaison/mise à jour du record sûre en cas de concurrence,
-- idempotence via une clé fournie par le client, et un outbox de
-- notifications écrit DANS la même transaction (jamais après un commit
-- non garanti côté client).
-- ============================================================

-- ── Colonnes numériques sur records : la comparaison "ce résultat bat-il
--    le record" doit se faire EN SQL (verrou de ligne), sans réimplémenter
--    parsePerf() côté serveur à chaque appel — le client (source de vérité
--    unique, tâche 11) envoie déjà la valeur parsée en paramètre pour un
--    NOUVEAU résultat ; il faut aussi connaître la valeur numérique du
--    record déjà stocké pour comparer. ──────────────────────────────────
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS pr_value numeric;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS sb_value numeric;

-- Nécessaire pour verrouiller/upserter une ligne records de façon sûre en
-- cas de concurrence (voir _apply_competition_result plus bas) — confirmé
-- au préalable qu'aucun doublon (athlete_id, discipline) n'existe déjà en
-- base (lecture seule, `select ... group by ... having count(*) > 1`,
-- zéro résultat).
ALTER TABLE public.records ADD CONSTRAINT records_athlete_discipline_key UNIQUE (athlete_id, discipline);

-- Backfill unique, au moment de cette migration seulement : reproduit
-- fidèlement parsePerf() (src/athlete/shared.js) — "1:02" style
-- minutes:secondes, sinon nombre décimal. Utilisée UNE FOIS ici, jamais
-- appelée par les RPC ci-dessous (qui reçoivent toujours la valeur déjà
-- parsée du client — seule source de vérité pour ne pas dupliquer la
-- règle de parsing, comme pour higherIsBetter).
CREATE OR REPLACE FUNCTION public._backfill_parse_perf(p_str text)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  parts text[];
  v_leading text;
BEGIN
  IF p_str IS NULL OR btrim(p_str) = '' THEN RETURN NULL; END IF;
  IF btrim(p_str) ~ '^\d+:\d+' THEN
    parts := regexp_split_to_array(btrim(p_str), ':');
    RETURN parts[1]::numeric * 60 + parts[2]::numeric;
  END IF;
  BEGIN
    RETURN btrim(p_str)::numeric;
  EXCEPTION WHEN OTHERS THEN
    -- parseFloat() JS est tolérant (ignore un suffixe non numérique,
    -- "14.20m" -> 14.20) ; le cast SQL direct ne l'est pas — on extrait le
    -- préfixe numérique en secours avant d'abandonner (NULL).
    v_leading := substring(btrim(p_str) from '^-?\d+\.?\d*');
    IF v_leading IS NULL OR v_leading = '' OR v_leading = '-' THEN RETURN NULL; END IF;
    RETURN v_leading::numeric;
  END;
END;
$$;

UPDATE public.records SET pr_value = public._backfill_parse_perf(pr) WHERE pr_value IS NULL AND pr IS NOT NULL;
UPDATE public.records SET sb_value = public._backfill_parse_perf(sb) WHERE sb_value IS NULL AND sb IS NOT NULL;

DROP FUNCTION public._backfill_parse_perf(text);

-- ── Idempotence générique, réutilisée par les 3 RPC ci-dessous ─────────────
CREATE TABLE public.rpc_idempotency (
  fn_name         text NOT NULL,
  idempotency_key text NOT NULL,
  actor_user_id   integer REFERENCES public.users(id) ON DELETE SET NULL,
  result          jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fn_name, idempotency_key)
);
ALTER TABLE public.rpc_idempotency ENABLE ROW LEVEL SECURITY;
-- Aucune policy cliente : uniquement lue/écrite par les fonctions
-- SECURITY DEFINER ci-dessous (elles s'exécutent avec les droits du
-- propriétaire de la fonction, qui contourne RLS sur ses propres tables —
-- même mécanisme que get_my_club_id()/signup_create_account existants).

-- ── Outbox de notifications : écrit DANS la même transaction que le
--    résultat/record, jamais après (le client ne dépêche les vraies
--    notifications qu'une fois le RPC revenu avec succès = commit
--    confirmé). ─────────────────────────────────────────────────────────
CREATE TABLE public.notification_outbox (
  id           bigserial PRIMARY KEY,
  club_id      integer REFERENCES public.clubs(id) ON DELETE SET NULL,
  athlete_id   integer REFERENCES public.athletes(id) ON DELETE SET NULL,
  event_type   text NOT NULL CHECK (event_type IN ('competition_result_added', 'competition_new_record')),
  payload      jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX notification_outbox_pending_idx ON public.notification_outbox (created_at) WHERE status = 'pending';

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notification_outbox_head_coach_read" ON public.notification_outbox
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id() AND get_my_role() = 'head_coach');
REVOKE ALL ON public.notification_outbox FROM anon;
GRANT SELECT ON public.notification_outbox TO authenticated;

-- ── Logique interne partagée (verrouillage + comparaison + record + outbox),
--    appelée par les deux RPC publiques qui enregistrent un résultat
--    (coach : add_competition_result ; athlète solo :
--    create_solo_competition_result) pour ne pas dupliquer la partie la
--    plus sensible (le verrou anti-concurrence sur records). ─────────────
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
  p_breakdown       jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
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
  INSERT INTO competition_results (competition_id, athlete_id, event, result, context)
  VALUES (p_competition_id, p_athlete_id, p_event, p_result, p_context)
  RETURNING id INTO v_result_id;

  IF p_also_log_performance THEN
    INSERT INTO athlete_performances (athlete_id, club_id, discipline, discipline_type, value, performance_date, context, breakdown)
    VALUES (p_athlete_id, p_club_id, p_event, p_event, p_result, p_performance_date, p_competition_name, p_breakdown)
    RETURNING id INTO v_performance_id;
  END IF;

  v_this_year := date_part('year', p_performance_date) = date_part('year', now());

  -- Tentative de création atomique de la ligne. Grâce à la contrainte
  -- UNIQUE(athlete_id, discipline), si deux transactions concurrentes
  -- tentent ceci EN MÊME TEMPS pour le tout premier résultat d'une
  -- discipline, Postgres n'en laisse réellement créer qu'UNE (l'autre
  -- devient un no-op) — RETURNING nous dit de façon fiable si C'EST NOUS
  -- qui avons gagné la course, sans fenêtre où les deux se croient "les
  -- premiers".
  INSERT INTO records (athlete_id, discipline, pr, pr_value, pr_date, sb, sb_value)
  VALUES (p_athlete_id, p_event, p_result, p_result_value, p_performance_date, p_result, p_result_value)
  ON CONFLICT (athlete_id, discipline) DO NOTHING
  RETURNING id INTO v_record_id;

  IF v_record_id IS NOT NULL THEN
    -- On a bien créé la ligne : premier résultat pour cette discipline
    -- (ou on a gagné la course face à une insertion concurrente) — dans
    -- les deux cas, c'est ce résultat qui est désormais stocké tel quel.
    v_is_pr := true;
    v_is_sb := v_this_year;
  ELSE
    -- La ligne existait déjà (ou vient d'être créée par une transaction
    -- concurrente juste avant nous) : verrou de ligne avant de comparer,
    -- pour que deux résultats concurrents battant le même record ne
    -- lisent jamais "pas encore battu" en même temps.
    SELECT id, pr_value, sb_value INTO v_record_id, v_existing_pr, v_existing_sb
    FROM records WHERE athlete_id = p_athlete_id AND discipline = p_event
    FOR UPDATE;

    -- v_existing_pr/sb NULL malgré une ligne existante : cas résiduel du
    -- backfill (ancien texte non interprétable par _backfill_parse_perf)
    -- — traité comme "rien à comparer, donc battu" plutôt que de bloquer
    -- silencieusement une vraie amélioration derrière un NULL.
    v_is_pr := v_existing_pr IS NULL OR (p_higher_is_better AND p_result_value > v_existing_pr) OR (NOT p_higher_is_better AND p_result_value < v_existing_pr);
    v_is_sb := v_this_year AND (v_existing_sb IS NULL OR (p_higher_is_better AND p_result_value > v_existing_sb) OR (NOT p_higher_is_better AND p_result_value < v_existing_sb));

    IF v_is_pr OR v_is_sb THEN
      UPDATE records SET
        pr       = CASE WHEN v_is_pr THEN p_result ELSE pr END,
        pr_value = CASE WHEN v_is_pr THEN p_result_value ELSE pr_value END,
        pr_date  = CASE WHEN v_is_pr THEN p_performance_date ELSE pr_date END,
        sb       = CASE WHEN v_is_sb THEN p_result ELSE sb END,
        sb_value = CASE WHEN v_is_sb THEN p_result_value ELSE sb_value END
      WHERE id = v_record_id;
    END IF;
  END IF;

  -- Outbox : écrit ici, dans la transaction — jamais après. Le client ne
  -- dépêchera les vraies notifications qu'après le retour en succès de
  -- cette fonction (donc après COMMIT confirmé) — le payload complet est
  -- renvoyé avec chaque événement pour que le client n'ait pas besoin
  -- d'un second aller-retour pour connaître le contenu à envoyer.
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

-- ── RPC 1 : créer une compétition + lister ses participants ────────────────
-- Autorisé pour : un coach/head coach de son propre club (n'importe quels
-- athlètes DE CE CLUB), ou un athlète créant une compétition pour
-- LUI-MÊME uniquement (un seul athlète dans p_athlete_entries, qui doit
-- être lui — utilisé par AthletePerfs.jsx, l'auto-déclaration d'une
-- compétition).
CREATE OR REPLACE FUNCTION public.create_competition_with_athletes(
  p_name             text,
  p_date             date,
  p_location         text,
  p_type             text,
  p_athlete_entries  jsonb,       -- [{"athleteId": 1, "plannedEvent": "100m"}, ...]
  p_idempotency_key  text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id     integer;
  v_club_id       integer;
  v_role          text;
  v_my_athlete_id integer;
  v_cached        jsonb;
  v_comp_id       integer;
  v_entry         jsonb;
  v_entry_count   integer;
  v_result        jsonb;
BEGIN
  SELECT id, club_id, role INTO v_caller_id, v_club_id, v_role
  FROM users WHERE lower(trim(auth_uid)) = lower(trim(auth.uid()::text)) LIMIT 1;
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Profil introuvable.'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT result INTO v_cached FROM rpc_idempotency
    WHERE fn_name = 'create_competition_with_athletes' AND idempotency_key = p_idempotency_key;
    IF v_cached IS NOT NULL THEN RETURN v_cached; END IF;
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Nom de compétition manquant.'; END IF;
  IF p_date IS NULL THEN RAISE EXCEPTION 'Date manquante.'; END IF;

  v_entry_count := jsonb_array_length(coalesce(p_athlete_entries, '[]'::jsonb));

  IF v_role IN ('head_coach', 'coach') THEN
    -- Le coach peut engager n'importe quel athlète de SON club — vérifié
    -- ligne par ligne plus bas (pas de confiance dans un club_id envoyé
    -- par le client).
    NULL;
  ELSE
    -- Un non-coach (athlète) ne peut créer une compétition QUE pour
    -- lui-même, seul participant.
    SELECT a.id INTO v_my_athlete_id FROM athletes a WHERE a.user_id = v_caller_id LIMIT 1;
    IF v_my_athlete_id IS NULL THEN RAISE EXCEPTION 'Profil athlète introuvable.'; END IF;
    IF v_entry_count <> 1 OR (p_athlete_entries->0->>'athleteId')::integer <> v_my_athlete_id THEN
      RAISE EXCEPTION 'Un athlète ne peut créer une compétition que pour lui-même.';
    END IF;
  END IF;

  INSERT INTO competitions (club_id, name, date, location, type)
  VALUES (v_club_id, btrim(p_name), p_date, nullif(btrim(coalesce(p_location, '')), ''), p_type)
  RETURNING id INTO v_comp_id;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(coalesce(p_athlete_entries, '[]'::jsonb)) LOOP
    IF NOT EXISTS (SELECT 1 FROM athletes WHERE id = (v_entry->>'athleteId')::integer AND club_id = v_club_id) THEN
      RAISE EXCEPTION 'Un des athlètes engagés n''est pas dans ton club.';
    END IF;
    INSERT INTO competition_athletes (competition_id, athlete_id, planned_event)
    VALUES (v_comp_id, (v_entry->>'athleteId')::integer, nullif(v_entry->>'plannedEvent', ''));
  END LOOP;

  v_result := jsonb_build_object('competitionId', v_comp_id, 'athleteCount', v_entry_count);

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO rpc_idempotency (fn_name, idempotency_key, actor_user_id, result)
    VALUES ('create_competition_with_athletes', p_idempotency_key, v_caller_id, v_result)
    ON CONFLICT (fn_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

-- ── RPC 2 : un coach ajoute le résultat d'un athlète à une compétition
--    existante ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_competition_result(
  p_competition_id   integer,
  p_athlete_id       integer,
  p_event            text,
  p_result           text,
  p_result_value     numeric,
  p_higher_is_better boolean,
  p_context          text DEFAULT NULL,
  p_idempotency_key  text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
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
    p_higher_is_better, p_context, v_comp.name, false, v_comp.date
  );

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO rpc_idempotency (fn_name, idempotency_key, actor_user_id, result)
    VALUES ('add_competition_result', p_idempotency_key, v_caller_id, v_result)
    ON CONFLICT (fn_name, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

-- ── RPC 3 : un athlète déclare seul une compétition + son résultat (tout
--    en une fois — le flux "handleAddComp" de AthletePerfs.jsx faisait
--    jusqu'à 5 écritures successives sans filet). ───────────────────────
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
  p_breakdown        jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
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
    p_higher_is_better, p_context, btrim(p_name), true, p_date, p_breakdown
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

-- ── RPC 4 : marquer des événements outbox comme traités (après dispatch
--    réel des notifications côté client) — jamais d'UPDATE direct sur
--    notification_outbox depuis le client (aucune policy d'écriture),
--    seulement via cette fonction, qui vérifie que l'appelant a bien le
--    droit de voir ces lignes (même club). ─────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_notification_outbox_sent(p_ids bigint[])
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_club_id integer;
BEGIN
  SELECT club_id INTO v_club_id FROM users WHERE lower(trim(auth_uid)) = lower(trim(auth.uid()::text)) LIMIT 1;
  IF v_club_id IS NULL THEN RAISE EXCEPTION 'Profil introuvable.'; END IF;

  UPDATE notification_outbox
  SET status = 'sent', processed_at = now()
  WHERE id = ANY(p_ids) AND club_id = v_club_id AND status = 'pending';
END;
$$;

-- ── Grants : exécution réservée à authenticated, jamais anon ────────────────
REVOKE ALL ON FUNCTION public.create_competition_with_athletes(text, date, text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_competition_result(integer, integer, text, text, numeric, boolean, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_solo_competition_result(text, date, text, text, text, text, numeric, boolean, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notification_outbox_sent(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_competition_with_athletes(text, date, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_competition_result(integer, integer, text, text, numeric, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_solo_competition_result(text, date, text, text, text, text, numeric, boolean, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_outbox_sent(bigint[]) TO authenticated;

COMMIT;
