BEGIN;

-- ============================================================
-- Import CSV transactionnel d'athlètes
--
-- Le client ne transmet jamais le club cible : il est déduit du JWT via
-- la ligne users de l'appelant. Une exception sur n'importe quelle ligne
-- annule implicitement toute la fonction PostgreSQL ; aucun demi-import
-- users/athletes ne peut donc rester en base.
--
-- Contrat p_rows (camelCase, identique au client) :
-- [{
--   "name": "Nora Vandenberghe",
--   "email": "nora@example.com",       -- optionnel
--   "age": 21,                          -- optionnel, 5..100
--   "mainDiscipline": "100 m",          -- optionnel
--   "secondaryDisciplines": ["200 m"],  -- optionnel
--   "group": "Sprint",                  -- optionnel
--   "level": "National"                 -- optionnel
-- }]
-- ============================================================

-- Les contrôles sont insensibles à la casse et aux espaces de bord. Cet
-- index non unique accélère les recherches sans risquer de bloquer la
-- migration si d'anciennes données contiennent déjà des variantes de casse.
CREATE INDEX IF NOT EXISTS users_email_normalized_lookup_idx
  ON public.users (lower(btrim(email)))
  WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.import_club_athletes(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id          integer;
  v_club_id            integer;
  v_caller_role        text;
  v_row_count          integer;
  v_row_number         integer;
  v_row                jsonb;
  v_name               text;
  v_email              text;
  v_age_text           text;
  v_age                integer;
  v_main_discipline    text;
  v_group_name         text;
  v_level              text;
  v_secondary          jsonb;
  v_user_id            integer;
  v_imported_count     integer := 0;
  v_created_user_count integer := 0;
  v_seen_emails        text[] := ARRAY[]::text[];
BEGIN
  -- Identité et club toujours issus du JWT, jamais de p_rows.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  SELECT u.id, u.club_id, u.role
  INTO v_caller_id, v_club_id, v_caller_role
  FROM public.users u
  WHERE lower(btrim(u.auth_uid)) = lower(auth.uid()::text)
  LIMIT 1;

  IF v_caller_id IS NULL OR v_club_id IS NULL THEN
    RAISE EXCEPTION 'Profil ou club introuvable.' USING ERRCODE = '42501';
  END IF;
  IF v_caller_role IS DISTINCT FROM 'head_coach' THEN
    RAISE EXCEPTION 'Import réservé au head coach.' USING ERRCODE = '42501';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows doit être un tableau JSON.' USING ERRCODE = '22023';
  END IF;
  IF octet_length(p_rows::text) > 2000000 THEN
    RAISE EXCEPTION 'Import trop volumineux (maximum 2 000 000 octets).' USING ERRCODE = '22023';
  END IF;

  v_row_count := jsonb_array_length(p_rows);
  IF v_row_count = 0 THEN
    RAISE EXCEPTION 'Aucun athlète à importer.' USING ERRCODE = '22023';
  END IF;
  IF v_row_count > 500 THEN
    RAISE EXCEPTION 'Maximum 500 athlètes par import.' USING ERRCODE = '22023';
  END IF;

  -- Première passe : tout valider avant la moindre écriture. La fonction
  -- est déjà atomique, mais cette passe rend aussi les erreurs rapides et
  -- évite de consommer inutilement des valeurs de séquences.
  FOR v_row, v_row_number IN
    SELECT item, ordinality::integer
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS rows(item, ordinality)
  LOOP
    IF jsonb_typeof(v_row) <> 'object' THEN
      RAISE EXCEPTION 'Ligne % : un objet JSON est attendu.', v_row_number USING ERRCODE = '22023';
    END IF;

    IF NOT (v_row ? 'name') OR jsonb_typeof(v_row -> 'name') <> 'string' THEN
      RAISE EXCEPTION 'Ligne % : le nom est obligatoire.', v_row_number USING ERRCODE = '22023';
    END IF;
    v_name := btrim(v_row ->> 'name');
    IF v_name = '' OR char_length(v_name) > 120 OR v_name ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'Ligne % : le nom doit contenir entre 1 et 120 caractères sans caractère de contrôle.', v_row_number USING ERRCODE = '22023';
    END IF;

    IF (v_row ? 'email') AND jsonb_typeof(v_row -> 'email') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Ligne % : email invalide.', v_row_number USING ERRCODE = '22023';
    END IF;
    v_email := nullif(lower(btrim(coalesce(v_row ->> 'email', ''))), '');
    IF v_email IS NOT NULL AND (
      char_length(v_email) > 254
      OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
    ) THEN
      RAISE EXCEPTION 'Ligne % : adresse email invalide.', v_row_number USING ERRCODE = '22023';
    END IF;

    IF (v_row ? 'age') AND jsonb_typeof(v_row -> 'age') NOT IN ('number', 'string', 'null') THEN
      RAISE EXCEPTION 'Ligne % : âge invalide.', v_row_number USING ERRCODE = '22023';
    END IF;
    v_age_text := btrim(coalesce(v_row ->> 'age', ''));
    IF v_age_text = '' THEN
      v_age := NULL;
    ELSIF v_age_text !~ '^[0-9]{1,3}$' THEN
      RAISE EXCEPTION 'Ligne % : l''âge doit être un entier entre 5 et 100.', v_row_number USING ERRCODE = '22023';
    ELSE
      v_age := v_age_text::integer;
      IF v_age NOT BETWEEN 5 AND 100 THEN
        RAISE EXCEPTION 'Ligne % : l''âge doit être un entier entre 5 et 100.', v_row_number USING ERRCODE = '22023';
      END IF;
    END IF;

    IF (v_row ? 'mainDiscipline') AND jsonb_typeof(v_row -> 'mainDiscipline') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Ligne % : discipline principale invalide.', v_row_number USING ERRCODE = '22023';
    END IF;
    IF (v_row ? 'group') AND jsonb_typeof(v_row -> 'group') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Ligne % : groupe invalide.', v_row_number USING ERRCODE = '22023';
    END IF;
    IF (v_row ? 'level') AND jsonb_typeof(v_row -> 'level') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Ligne % : niveau invalide.', v_row_number USING ERRCODE = '22023';
    END IF;

    v_main_discipline := nullif(btrim(coalesce(v_row ->> 'mainDiscipline', '')), '');
    v_group_name := nullif(btrim(coalesce(v_row ->> 'group', '')), '');
    v_level := nullif(btrim(coalesce(v_row ->> 'level', '')), '');
    IF char_length(coalesce(v_main_discipline, '')) > 160 OR coalesce(v_main_discipline, '') ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'Ligne % : discipline principale trop longue ou invalide (maximum 160 caractères).', v_row_number USING ERRCODE = '22023';
    END IF;
    IF char_length(coalesce(v_group_name, '')) > 160 OR coalesce(v_group_name, '') ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'Ligne % : groupe trop long ou invalide (maximum 160 caractères).', v_row_number USING ERRCODE = '22023';
    END IF;
    IF char_length(coalesce(v_level, '')) > 160 OR coalesce(v_level, '') ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'Ligne % : niveau trop long ou invalide (maximum 160 caractères).', v_row_number USING ERRCODE = '22023';
    END IF;

    IF NOT (v_row ? 'secondaryDisciplines') OR jsonb_typeof(v_row -> 'secondaryDisciplines') = 'null' THEN
      v_secondary := '[]'::jsonb;
    ELSE
      IF jsonb_typeof(v_row -> 'secondaryDisciplines') <> 'array' THEN
        RAISE EXCEPTION 'Ligne % : secondaryDisciplines doit être un tableau.', v_row_number USING ERRCODE = '22023';
      END IF;
      IF jsonb_array_length(v_row -> 'secondaryDisciplines') > 20 THEN
        RAISE EXCEPTION 'Ligne % : maximum 20 disciplines secondaires.', v_row_number USING ERRCODE = '22023';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_row -> 'secondaryDisciplines') AS discipline(item)
        WHERE jsonb_typeof(item) <> 'string'
          OR char_length(btrim(item #>> '{}')) > 160
          OR btrim(item #>> '{}') ~ '[[:cntrl:]]'
      ) THEN
        RAISE EXCEPTION 'Ligne % : chaque discipline secondaire doit être un texte de 160 caractères maximum.', v_row_number USING ERRCODE = '22023';
      END IF;
    END IF;

    IF v_email IS NOT NULL THEN
      IF v_email = ANY(v_seen_emails) THEN
        RAISE EXCEPTION 'Ligne % : email présent plusieurs fois dans cet import.', v_row_number USING ERRCODE = '23505';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.users existing
        WHERE existing.club_id = v_club_id
          AND lower(btrim(existing.email)) = v_email
      ) THEN
        RAISE EXCEPTION 'Ligne % : cet email est déjà présent dans le club.', v_row_number USING ERRCODE = '23505';
      END IF;
      -- users.email est globalement UNIQUE dans le schéma historique. On
      -- refuse donc aussi un email d'un autre club, sans divulguer lequel.
      IF EXISTS (
        SELECT 1 FROM public.users existing
        WHERE lower(btrim(existing.email)) = v_email
      ) THEN
        RAISE EXCEPTION 'Ligne % : cet email est déjà utilisé.', v_row_number USING ERRCODE = '23505';
      END IF;
      v_seen_emails := array_append(v_seen_emails, v_email);
    END IF;
  END LOOP;

  -- Deuxième passe : création cohérente. Une ligne sans email reste un
  -- athlète autonome (comportement existant de createAthlete) ; avec email,
  -- la ligne users est créée puis reliée dans la même transaction.
  FOR v_row, v_row_number IN
    SELECT item, ordinality::integer
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS rows(item, ordinality)
  LOOP
    v_name := btrim(v_row ->> 'name');
    v_email := nullif(lower(btrim(coalesce(v_row ->> 'email', ''))), '');
    v_age_text := btrim(coalesce(v_row ->> 'age', ''));
    v_age := CASE WHEN v_age_text = '' THEN NULL ELSE v_age_text::integer END;
    v_main_discipline := nullif(btrim(coalesce(v_row ->> 'mainDiscipline', '')), '');
    v_group_name := nullif(btrim(coalesce(v_row ->> 'group', '')), '');
    v_level := nullif(btrim(coalesce(v_row ->> 'level', '')), '');

    IF NOT (v_row ? 'secondaryDisciplines') OR jsonb_typeof(v_row -> 'secondaryDisciplines') = 'null' THEN
      v_secondary := '[]'::jsonb;
    ELSE
      SELECT coalesce(
        jsonb_agg(to_jsonb(btrim(item #>> '{}')) ORDER BY ordinality)
          FILTER (WHERE btrim(item #>> '{}') <> ''),
        '[]'::jsonb
      )
      INTO v_secondary
      FROM jsonb_array_elements(v_row -> 'secondaryDisciplines')
        WITH ORDINALITY AS disciplines(item, ordinality);
    END IF;

    v_user_id := NULL;
    IF v_email IS NOT NULL THEN
      BEGIN
        INSERT INTO public.users (club_id, name, email, role)
        VALUES (v_club_id, v_name, v_email, 'athlete')
        RETURNING id INTO v_user_id;
      EXCEPTION WHEN unique_violation THEN
        -- Protection contre deux imports concurrents du même email. Lever
        -- l'erreur ici annule aussi toutes les lignes déjà créées.
        RAISE EXCEPTION 'Ligne % : cet email vient d''être utilisé par un autre import.', v_row_number USING ERRCODE = '23505';
      END;
      v_created_user_count := v_created_user_count + 1;
    END IF;

    INSERT INTO public.athletes (
      club_id,
      name,
      age,
      main_discipline,
      group_name,
      user_id,
      profile_data
    ) VALUES (
      v_club_id,
      v_name,
      v_age,
      v_main_discipline,
      v_group_name,
      v_user_id,
      jsonb_build_object(
        'level', v_level,
        'secondary_disciplines', v_secondary,
        'profile', jsonb_build_object(
          'speed', 50,
          'strength', 50,
          'explosivity', 50,
          'endurance', 50,
          'technique', 50,
          'recoveryRate', 'normale',
          'volumeTolerance', 'modérée',
          'intensityTolerance', 'modérée',
          'psychProfile', NULL
        )
      )
    );

    v_imported_count := v_imported_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'importedCount', v_imported_count,
    'createdUserCount', v_created_user_count
  );
END;
$$;

COMMENT ON FUNCTION public.import_club_athletes(jsonb) IS
  'Import atomique de 1 à 500 athlètes dans le club du head coach authentifié.';

REVOKE ALL ON FUNCTION public.import_club_athletes(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_club_athletes(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.import_club_athletes(jsonb) TO authenticated;

COMMIT;
