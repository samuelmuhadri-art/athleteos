BEGIN;

-- "users_club" (FOR ALL USING club_id = get_my_club_id()) ne vérifiait que
-- l'appartenance au club, jamais "est-ce bien MA ligne" — n'importe quel
-- membre authentifié pouvait donc modifier (voire changer le rôle de)
-- n'importe quel AUTRE membre du même club via un appel direct à l'API,
-- même si aucun écran de l'app ne le permettait dans l'UI. Découvert en
-- construisant les réglages de compte.
DROP POLICY IF EXISTS "users_club" ON public.users;

-- Lecture : tout le club (nécessaire pour messagerie, listes d'athlètes...).
CREATE POLICY "users_select_club" ON public.users
  FOR SELECT TO public
  USING (club_id = get_my_club_id());

-- Écriture : uniquement sa propre ligne.
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO public
  USING (auth_uid = auth.uid()::text)
  WITH CHECK (auth_uid = auth.uid()::text);

-- Création : un coach peut inscrire un athlète dans SON club (AthleteList.jsx).
CREATE POLICY "users_insert_by_coach" ON public.users
  FOR INSERT TO public
  WITH CHECK (
    club_id = get_my_club_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_uid = auth.uid()::text AND u.club_id = get_my_club_id() AND u.role IN ('head_coach','coach')
    )
  );

-- Pas de policy DELETE cliente : la suppression d'un membre (avec son compte
-- auth) passe désormais par l'Edge Function admin-actions (service role),
-- jamais directement depuis le navigateur.

COMMIT;
