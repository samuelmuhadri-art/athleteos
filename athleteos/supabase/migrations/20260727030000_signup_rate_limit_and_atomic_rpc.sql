BEGIN;

-- ============================================================
-- Tâche 3 — durcissement de l'inscription publique (signup)
-- ============================================================

-- 1) Rate limiting : une ligne par tentative d'inscription (IP + email
--    normalisé), consultée par fenêtre glissante depuis l'Edge Function
--    signup. Jamais accédée depuis le client — RLS activée, aucune policy
--    (service_role bypass RLS de toute façon ; ceinture + bretelles si un
--    jour cette table était exposée par erreur via l'API REST).
CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signup_attempts_ip_idx ON public.signup_attempts (ip, created_at);
CREATE INDEX IF NOT EXISTS signup_attempts_email_idx ON public.signup_attempts (email, created_at);
ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;

-- 2) Création atomique club + users + athletes en une seule transaction SQL.
--    L'API Auth (auth.admin.createUser) ne peut pas participer à cette
--    transaction (c'est un appel HTTP séparé, pas du SQL) — elle reste gérée
--    par l'Edge Function, avec compensation (suppression du compte Auth) si
--    cet appel RPC échoue après coup. Mais club+users+athletes, eux, sont
--    tout-ou-rien : plus de club orphelin sans coach, plus de ligne users
--    orpheline sans sa ligne athletes (bug présent dans l'ancienne version :
--    un échec sur l'insert athletes ne nettoyait jamais la ligne users déjà
--    créée juste avant).
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
SET search_path = public
AS $$
DECLARE
  v_club_id bigint;
  v_user_id bigint;
  v_role text;
BEGIN
  IF p_mode = 'create_club' THEN
    INSERT INTO clubs (name, invite_code) VALUES (p_club_name, p_invite_code) RETURNING id INTO v_club_id;
    v_role := 'head_coach';
  ELSIF p_mode = 'join_club' THEN
    SELECT id INTO v_club_id FROM clubs WHERE invite_code = p_invite_code;
    IF v_club_id IS NULL THEN
      RAISE EXCEPTION 'invalid_invite_code';
    END IF;
    v_role := 'athlete';
  ELSE
    RAISE EXCEPTION 'invalid_mode';
  END IF;

  INSERT INTO users (auth_uid, name, email, role, club_id)
  VALUES (p_auth_uid, p_name, p_email, v_role, v_club_id)
  RETURNING id INTO v_user_id;

  IF p_mode = 'join_club' THEN
    INSERT INTO athletes (club_id, name, user_id) VALUES (v_club_id, p_name, v_user_id);
  END IF;

  RETURN jsonb_build_object('clubId', v_club_id, 'userId', v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.signup_create_account(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.signup_create_account(text, text, text, text, text, text) TO service_role;

COMMIT;
