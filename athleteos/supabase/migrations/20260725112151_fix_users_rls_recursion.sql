BEGIN;

-- La policy "Club members only" fait un SELECT sur users DEPUIS une policy
-- sur users -> boucle infinie dès que RLS est actif sur cette table.
-- get_my_club_id() est SECURITY DEFINER donc contourne RLS en interne
-- (comme sur athletes/sessions/etc.) -> pas de récursion.
DROP POLICY IF EXISTS "Club members only" ON public.users;

CREATE POLICY "users_club" ON public.users
  FOR ALL TO public
  USING (club_id = get_my_club_id());

COMMIT;
