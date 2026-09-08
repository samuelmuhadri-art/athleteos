BEGIN;

ALTER TABLE public.session_templates
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'club',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE public.session_templates
  DROP CONSTRAINT IF EXISTS session_templates_scope_check;
ALTER TABLE public.session_templates
  ADD CONSTRAINT session_templates_scope_check CHECK (scope IN ('personal', 'club'));

ALTER TABLE public.session_templates
  DROP CONSTRAINT IF EXISTS session_templates_club_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS session_templates_club_name_unique
  ON public.session_templates (club_id, name)
  WHERE scope = 'club';
CREATE UNIQUE INDEX IF NOT EXISTS session_templates_personal_name_unique
  ON public.session_templates (club_id, created_by, name)
  WHERE scope = 'personal';
CREATE INDEX IF NOT EXISTS session_templates_library_lookup
  ON public.session_templates (club_id, scope, category, updated_at DESC);

DROP POLICY IF EXISTS session_templates_club_read ON public.session_templates;
DROP POLICY IF EXISTS session_templates_staff_manage ON public.session_templates;
DROP POLICY IF EXISTS session_templates_library_read ON public.session_templates;
DROP POLICY IF EXISTS session_templates_library_manage ON public.session_templates;

CREATE POLICY session_templates_library_read ON public.session_templates
  FOR SELECT TO authenticated
  USING (
    club_id = public.get_my_club_id()
    AND public.get_my_role() IN ('head_coach', 'coach')
    AND (scope = 'club' OR created_by = public.get_my_user_id())
  );

CREATE POLICY session_templates_library_manage ON public.session_templates
  FOR ALL TO authenticated
  USING (
    club_id = public.get_my_club_id()
    AND public.get_my_role() IN ('head_coach', 'coach')
    AND (
      created_by = public.get_my_user_id()
      OR (scope = 'club' AND public.get_my_role() = 'head_coach')
    )
  )
  WITH CHECK (
    club_id = public.get_my_club_id()
    AND public.get_my_role() IN ('head_coach', 'coach')
    AND created_by = public.get_my_user_id()
  );

-- Les mutations passent par les RPC ci-dessous. Cela empêche un client de
-- modifier directement created_by, club_id ou la portée d'un autre coach.
REVOKE INSERT, UPDATE, DELETE ON public.session_templates FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.session_template_documents FROM authenticated;

CREATE OR REPLACE FUNCTION public.upsert_session_template(
  p_template_id bigint,
  p_template jsonb,
  p_document_ids bigint[] DEFAULT ARRAY[]::bigint[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id integer := public.get_my_user_id();
  v_club_id integer := public.get_my_club_id();
  v_role text := public.get_my_role();
  v_existing public.session_templates%ROWTYPE;
  v_name text := btrim(coalesce(p_template->>'name', ''));
  v_title text := btrim(coalesce(p_template->>'title', ''));
  v_scope text := coalesce(nullif(p_template->>'scope', ''), 'personal');
  v_tags text[] := ARRAY(
    SELECT DISTINCT btrim(value)
    FROM jsonb_array_elements_text(coalesce(p_template->'tags', '[]'::jsonb)) tag(value)
    WHERE btrim(value) <> ''
    LIMIT 12
  );
  v_document_ids bigint[] := ARRAY(
    SELECT DISTINCT value
    FROM unnest(coalesce(p_document_ids, ARRAY[]::bigint[])) item(value)
    WHERE value IS NOT NULL
  );
  v_id bigint;
BEGIN
  IF v_role NOT IN ('head_coach', 'coach') OR v_user_id IS NULL OR v_club_id IS NULL THEN
    RAISE EXCEPTION 'Action non autorisee.';
  END IF;
  IF v_name = '' OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'Le nom du modele doit contenir entre 1 et 120 caracteres.';
  END IF;
  IF v_title = '' OR char_length(v_title) > 160 THEN
    RAISE EXCEPTION 'Le titre de la seance doit contenir entre 1 et 160 caracteres.';
  END IF;
  IF v_scope NOT IN ('personal', 'club') THEN
    RAISE EXCEPTION 'Portee de modele invalide.';
  END IF;
  IF coalesce((p_template->>'durationMinutes')::integer, 0) NOT BETWEEN 1 AND 1440 THEN
    RAISE EXCEPTION 'Duree de modele invalide.';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_tags) tag WHERE char_length(tag) > 32) THEN
    RAISE EXCEPTION 'Un tag ne peut pas depasser 32 caracteres.';
  END IF;
  IF cardinality(v_document_ids) <> (
    SELECT count(*) FROM public.documents
    WHERE id = ANY(v_document_ids) AND club_id = v_club_id
  ) THEN
    RAISE EXCEPTION 'Un document est introuvable dans ce club.';
  END IF;

  IF p_template_id IS NULL THEN
    INSERT INTO public.session_templates (
      club_id, name, category, type, training_focus, title, duration_minutes,
      description, instructions, created_by, scope, tags
    ) VALUES (
      v_club_id, v_name, nullif(p_template->>'category', ''), nullif(p_template->>'type', ''),
      nullif(p_template->>'trainingFocus', ''), v_title, (p_template->>'durationMinutes')::integer,
      nullif(p_template->>'description', ''), nullif(p_template->>'instructions', ''),
      v_user_id, v_scope, v_tags
    ) RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_existing
    FROM public.session_templates
    WHERE id = p_template_id AND club_id = v_club_id
    FOR UPDATE;
    IF NOT FOUND OR (v_existing.scope = 'personal' AND v_existing.created_by <> v_user_id) THEN
      RAISE EXCEPTION 'Modele introuvable.';
    END IF;
    IF v_existing.created_by <> v_user_id AND v_role <> 'head_coach' THEN
      RAISE EXCEPTION 'Seul le createur ou le head coach peut modifier ce modele.';
    END IF;
    IF v_scope = 'personal' AND v_existing.created_by <> v_user_id THEN
      RAISE EXCEPTION 'Un modele de club cree par un autre coach ne peut pas devenir personnel.';
    END IF;

    UPDATE public.session_templates SET
      name = v_name,
      category = nullif(p_template->>'category', ''),
      type = nullif(p_template->>'type', ''),
      training_focus = nullif(p_template->>'trainingFocus', ''),
      title = v_title,
      duration_minutes = (p_template->>'durationMinutes')::integer,
      description = nullif(p_template->>'description', ''),
      instructions = nullif(p_template->>'instructions', ''),
      scope = v_scope,
      tags = v_tags,
      updated_at = now()
    WHERE id = p_template_id
    RETURNING id INTO v_id;
  END IF;

  DELETE FROM public.session_template_documents WHERE template_id = v_id;
  INSERT INTO public.session_template_documents(template_id, document_id)
  SELECT v_id, document_id FROM unnest(v_document_ids) document_id;

  RETURN jsonb_build_object('templateId', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Un modele portant ce nom existe deja pour cette portee.';
END;
$$;

CREATE OR REPLACE FUNCTION public.duplicate_session_template(
  p_template_id bigint,
  p_name text,
  p_scope text DEFAULT 'personal'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source public.session_templates%ROWTYPE;
  v_document_ids bigint[];
BEGIN
  IF public.get_my_role() NOT IN ('head_coach', 'coach') THEN
    RAISE EXCEPTION 'Action non autorisee.';
  END IF;
  SELECT * INTO v_source FROM public.session_templates
  WHERE id = p_template_id
    AND club_id = public.get_my_club_id()
    AND (scope = 'club' OR created_by = public.get_my_user_id());
  IF NOT FOUND THEN RAISE EXCEPTION 'Modele introuvable.'; END IF;

  SELECT coalesce(array_agg(document_id), ARRAY[]::bigint[]) INTO v_document_ids
  FROM public.session_template_documents WHERE template_id = p_template_id;

  RETURN public.upsert_session_template(null, jsonb_build_object(
    'name', btrim(p_name),
    'title', v_source.title,
    'category', v_source.category,
    'type', v_source.type,
    'trainingFocus', v_source.training_focus,
    'durationMinutes', v_source.duration_minutes,
    'description', v_source.description,
    'instructions', v_source.instructions,
    'scope', p_scope,
    'tags', to_jsonb(v_source.tags)
  ), v_document_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_session_template(p_template_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template public.session_templates%ROWTYPE;
  v_role text := public.get_my_role();
BEGIN
  IF v_role NOT IN ('head_coach', 'coach') THEN RAISE EXCEPTION 'Action non autorisee.'; END IF;
  SELECT * INTO v_template FROM public.session_templates
  WHERE id = p_template_id AND club_id = public.get_my_club_id()
  FOR UPDATE;
  IF NOT FOUND OR (v_template.scope = 'personal' AND v_template.created_by <> public.get_my_user_id()) THEN
    RAISE EXCEPTION 'Modele introuvable.';
  END IF;
  IF v_template.created_by <> public.get_my_user_id() AND v_role <> 'head_coach' THEN
    RAISE EXCEPTION 'Seul le createur ou le head coach peut supprimer ce modele.';
  END IF;
  DELETE FROM public.session_templates WHERE id = p_template_id;
  RETURN jsonb_build_object('templateId', p_template_id, 'deleted', true);
END;
$$;

-- Compatibilité avec le bouton historique « enregistrer comme modèle ».
-- Sa portée reste « club » ; les nouveaux écrans utilisent upsert_session_template.
CREATE OR REPLACE FUNCTION public.save_session_template(p_name text, p_session_id integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session public.sessions%ROWTYPE;
  v_existing public.session_templates%ROWTYPE;
  v_result jsonb;
  v_document_ids bigint[];
BEGIN
  IF public.get_my_role() NOT IN ('head_coach', 'coach') THEN RAISE EXCEPTION 'Action non autorisee.'; END IF;
  SELECT * INTO v_session FROM public.sessions
  WHERE id = p_session_id AND club_id = public.get_my_club_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'Seance introuvable.'; END IF;
  SELECT * INTO v_existing FROM public.session_templates
  WHERE club_id = public.get_my_club_id() AND name = btrim(p_name) AND scope = 'club';
  IF FOUND AND v_existing.created_by <> public.get_my_user_id() AND public.get_my_role() <> 'head_coach' THEN
    RAISE EXCEPTION 'Un modele de club portant ce nom appartient deja a un autre coach.';
  END IF;
  SELECT coalesce(array_agg(document_id), ARRAY[]::bigint[]) INTO v_document_ids
  FROM public.session_documents WHERE session_id = p_session_id;
  v_result := public.upsert_session_template(v_existing.id, jsonb_build_object(
    'name', btrim(p_name), 'title', v_session.title, 'category', v_session.category,
    'type', v_session.type, 'trainingFocus', v_session.training_focus,
    'durationMinutes', v_session.duration_minutes, 'description', v_session.description,
    'instructions', v_session.instructions, 'scope', 'club', 'tags', '[]'::jsonb
  ), v_document_ids);
  RETURN (v_result->>'templateId')::bigint;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_session_from_template(
  p_template_id bigint,
  p_schedule jsonb,
  p_athlete_ids integer[],
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template public.session_templates%ROWTYPE;
  v_result jsonb;
  v_document_ids bigint[];
BEGIN
  IF public.get_my_role() NOT IN ('head_coach', 'coach') THEN RAISE EXCEPTION 'Action non autorisee.'; END IF;
  SELECT * INTO v_template FROM public.session_templates
  WHERE id = p_template_id
    AND club_id = public.get_my_club_id()
    AND (scope = 'club' OR created_by = public.get_my_user_id());
  IF NOT FOUND THEN RAISE EXCEPTION 'Modele introuvable.'; END IF;
  v_result := public.create_session_with_athletes(jsonb_build_object(
    'title', v_template.title, 'category', v_template.category, 'type', v_template.type,
    'trainingFocus', v_template.training_focus, 'durationMinutes', v_template.duration_minutes,
    'description', v_template.description, 'instructions', v_template.instructions
  ) || p_schedule, p_athlete_ids, p_idempotency_key);
  UPDATE public.sessions SET source_kind = 'template' WHERE id = (v_result->>'sessionId')::integer;
  SELECT array_agg(document_id) INTO v_document_ids FROM public.session_template_documents WHERE template_id = p_template_id;
  IF cardinality(coalesce(v_document_ids, ARRAY[]::bigint[])) > 0 THEN
    PERFORM public.publish_session_documents((v_result->>'sessionId')::integer, v_document_ids, NULL, p_idempotency_key);
  END IF;
  RETURN v_result || jsonb_build_object('documentCount', cardinality(coalesce(v_document_ids, ARRAY[]::bigint[])));
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_session_template(bigint, jsonb, bigint[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.duplicate_session_template(bigint, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_session_template(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_session_template(bigint, jsonb, bigint[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_session_template(bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_session_template(bigint) TO authenticated;

COMMIT;
