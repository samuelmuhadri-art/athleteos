BEGIN;

-- Les anciennes colonnes utilisaient `timestamp` alors qu'un message ou une
-- alerte représente un instant réel. La base locale et la production Supabase
-- écrivent en UTC : AT TIME ZONE 'UTC' conserve donc exactement l'instant
-- historique au moment du passage vers timestamptz.
ALTER TABLE public.messages
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC';
ALTER TABLE public.messages
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.alerts
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC';
ALTER TABLE public.alerts
  ALTER COLUMN created_at SET DEFAULT now();

-- `is_read` reste présent pour la compatibilité avec les anciens clients.
-- L'état personnel multi-coach vit désormais dans alert_read_states, tandis
-- que la résolution et l'archivage sont des états métier portés par l'alerte.
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by integer REFERENCES public.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.alert_read_states (
  alert_id integer NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, user_id)
);

CREATE INDEX IF NOT EXISTS alerts_active_club_created_idx
  ON public.alerts (club_id, created_at DESC)
  WHERE resolved_at IS NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS alert_read_states_user_idx
  ON public.alert_read_states (user_id, read_at DESC);

ALTER TABLE public.alert_read_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alert_read_states_own_read ON public.alert_read_states;
CREATE POLICY alert_read_states_own_read ON public.alert_read_states
  FOR SELECT TO authenticated
  USING (
    user_id = public.get_my_user_id()
    AND EXISTS (
      SELECT 1 FROM public.alerts alert
      WHERE alert.id = alert_read_states.alert_id
        AND alert.club_id = public.get_my_club_id()
    )
  );

DROP POLICY IF EXISTS alert_read_states_own_write ON public.alert_read_states;
CREATE POLICY alert_read_states_own_write ON public.alert_read_states
  FOR ALL TO authenticated
  USING (user_id = public.get_my_user_id())
  WITH CHECK (
    user_id = public.get_my_user_id()
    AND public.get_my_role() IN ('head_coach', 'coach')
    AND EXISTS (
      SELECT 1 FROM public.alerts alert
      WHERE alert.id = alert_read_states.alert_id
        AND alert.club_id = public.get_my_club_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_read_states TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_alerts_read(p_alert_ids integer[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id integer := public.get_my_user_id();
  v_count integer;
BEGIN
  IF v_user_id IS NULL OR public.get_my_role() NOT IN ('head_coach', 'coach') THEN
    RAISE EXCEPTION 'Action non autorisee.';
  END IF;

  INSERT INTO public.alert_read_states (alert_id, user_id, read_at)
  SELECT alert.id, v_user_id, now()
  FROM public.alerts alert
  WHERE alert.id = ANY(coalesce(p_alert_ids, ARRAY[]::integer[]))
    AND alert.club_id = public.get_my_club_id()
  ON CONFLICT (alert_id, user_id) DO UPDATE SET read_at = EXCLUDED.read_at;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Compatibilité descendante. Ce booléen ne doit plus servir de source de
  -- vérité multi-coach, mais garde les anciens clients fonctionnels.
  UPDATE public.alerts
  SET is_read = true
  WHERE id = ANY(coalesce(p_alert_ids, ARRAY[]::integer[]))
    AND club_id = public.get_my_club_id();

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_alert_resolution(
  p_alert_id integer,
  p_resolved boolean,
  p_archived boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id integer := public.get_my_user_id();
BEGIN
  IF v_user_id IS NULL OR public.get_my_role() NOT IN ('head_coach', 'coach') THEN
    RAISE EXCEPTION 'Action non autorisee.';
  END IF;

  UPDATE public.alerts
  SET resolved_at = CASE WHEN p_resolved THEN coalesce(resolved_at, now()) ELSE NULL END,
      resolved_by = CASE WHEN p_resolved THEN coalesce(resolved_by, v_user_id) ELSE NULL END,
      archived_at = CASE WHEN p_archived THEN coalesce(archived_at, now()) ELSE NULL END,
      archived_by = CASE WHEN p_archived THEN coalesce(archived_by, v_user_id) ELSE NULL END
  WHERE id = p_alert_id AND club_id = public.get_my_club_id();

  IF NOT FOUND THEN RAISE EXCEPTION 'Alerte introuvable.'; END IF;
  RETURN jsonb_build_object('alertId', p_alert_id, 'resolved', p_resolved, 'archived', p_archived);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_alerts_read(integer[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_alert_resolution(integer, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_alerts_read(integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_alert_resolution(integer, boolean, boolean) TO authenticated;

COMMIT;
