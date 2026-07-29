BEGIN;

-- ============================================================
-- Rattachement d'un athlète précréé lors de join_club
--
-- L'import CSV crée volontairement users + athletes avant que l'athlète
-- possède un compte Auth. Sans ce chemin de réclamation, users.email
-- (UNIQUE) ferait échouer signup_create_account après la création Auth.
--
-- Règles de sécurité :
--   - uniquement join_club et le club résolu par son code d'invitation ;
--   - email normalisé identique dans CE club ;
--   - ligne role=athlete sans auth_uid/auth_id ;
--   - exactement un profil athletes déjà relié dans ce même club ;
--   - verrouillage FOR UPDATE puis UPDATE conditionnel anti-concurrence ;
--   - aucun nom/profil sportif importé n'est écrasé ;
--   - aucune nouvelle ligne athletes n'est créée lors d'une réclamation.
-- ============================================================

CREATE OR REPLACE FUNCTION public.signup_create_account(
  p_mode text,
  p_club_name text,
  p_invite_code text,
  p_auth_uid text,
  p_name text,
  p_email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_club_id                integer;
  v_user_id                integer;
  v_role                   text;
  v_email                  text;
  v_precreated_count       integer;
  v_precreated_user_id     integer;
  v_athlete_count          integer;
  v_athlete_in_club_count  integer;
  v_updated_count          integer;
BEGIN
  v_email := lower(btrim(coalesce(p_email, '')));
  IF v_email = '' OR char_length(v_email) > 254
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
  THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;
  IF p_auth_uid IS NULL OR p_auth_uid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'invalid_auth_uid' USING ERRCODE = '22023';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' OR char_length(btrim(p_name)) > 100 THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.users existing
    WHERE lower(btrim(existing.auth_uid)) = lower(p_auth_uid)
  ) THEN
    RAISE EXCEPTION 'auth_uid_already_linked' USING ERRCODE = '23505';
  END IF;

  IF p_mode = 'create_club' THEN
    INSERT INTO public.clubs (name, invite_code)
    VALUES (p_club_name, p_invite_code)
    RETURNING id INTO v_club_id;
    v_role := 'head_coach';

  ELSIF p_mode = 'join_club' THEN
    SELECT c.id
    INTO v_club_id
    FROM public.clubs c
    WHERE c.invite_code = p_invite_code;
    IF v_club_id IS NULL THEN
      RAISE EXCEPTION 'invalid_invite_code' USING ERRCODE = '22023';
    END IF;
    v_role := 'athlete';

    -- Compte précréé par import dans CE club uniquement. Le comptage
    -- explicite refuse une ancienne anomalie de casse plutôt que de choisir
    -- arbitrairement une identité parmi plusieurs lignes.
    SELECT count(*)::integer
    INTO v_precreated_count
    FROM public.users imported
    WHERE imported.club_id = v_club_id
      AND imported.role = 'athlete'
      AND imported.auth_uid IS NULL
      AND imported.auth_id IS NULL
      AND lower(btrim(imported.email)) = v_email;

    IF v_precreated_count > 1 THEN
      RAISE EXCEPTION 'ambiguous_imported_athlete' USING ERRCODE = '23505';
    END IF;

    IF v_precreated_count = 1 THEN
      SELECT imported.id
      INTO v_precreated_user_id
      FROM public.users imported
      WHERE imported.club_id = v_club_id
        AND imported.role = 'athlete'
        AND imported.auth_uid IS NULL
        AND imported.auth_id IS NULL
        AND lower(btrim(imported.email)) = v_email
      FOR UPDATE;

      -- La ligne doit provenir d'une création cohérente users+athletes.
      -- On ne "répare" pas silencieusement une ligne orpheline et on ne
      -- crée surtout jamais un second profil sportif.
      SELECT
        count(*)::integer,
        (count(*) FILTER (WHERE a.club_id = v_club_id))::integer
      INTO v_athlete_count, v_athlete_in_club_count
      FROM public.athletes a
      WHERE a.user_id = v_precreated_user_id;

      IF v_athlete_count <> 1 OR v_athlete_in_club_count <> 1 THEN
        RAISE EXCEPTION 'invalid_imported_athlete_profile' USING ERRCODE = '23514';
      END IF;

      UPDATE public.users
      SET auth_uid = p_auth_uid
      WHERE id = v_precreated_user_id
        AND club_id = v_club_id
        AND role = 'athlete'
        AND auth_uid IS NULL
        AND auth_id IS NULL;
      GET DIAGNOSTICS v_updated_count = ROW_COUNT;
      IF v_updated_count <> 1 THEN
        RAISE EXCEPTION 'imported_athlete_already_claimed' USING ERRCODE = '23505';
      END IF;

      RETURN jsonb_build_object(
        'clubId', v_club_id,
        'userId', v_precreated_user_id,
        'claimedImportedAthlete', true
      );
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_mode' USING ERRCODE = '22023';
  END IF;

  -- Aucun compte importé réclamable. Une ligne portant déjà cet email
  -- (même club lié, autre club, ou autre rôle) ne doit jamais être prise
  -- ni contournée : l'Edge Function supprimera le compte Auth nouvellement
  -- créé en compensation de cette erreur transactionnelle.
  IF EXISTS (
    SELECT 1 FROM public.users existing
    WHERE lower(btrim(existing.email)) = v_email
  ) THEN
    RAISE EXCEPTION 'email_already_reserved' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.users (auth_uid, name, email, role, club_id)
  VALUES (p_auth_uid, btrim(p_name), v_email, v_role, v_club_id)
  RETURNING id INTO v_user_id;

  IF p_mode = 'join_club' THEN
    INSERT INTO public.athletes (club_id, name, user_id)
    VALUES (v_club_id, btrim(p_name), v_user_id);
  END IF;

  RETURN jsonb_build_object(
    'clubId', v_club_id,
    'userId', v_user_id,
    'claimedImportedAthlete', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.signup_create_account(text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.signup_create_account(text, text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.signup_create_account(text, text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.signup_create_account(text, text, text, text, text, text) TO service_role;

COMMIT;
