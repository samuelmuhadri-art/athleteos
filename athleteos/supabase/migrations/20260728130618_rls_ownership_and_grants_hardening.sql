BEGIN;

-- ============================================================
-- Tâche 6 — audit RLS/grants/vues/fonctions par rôle
--
-- Constat principal (base réelle inspectée en lecture seule via
-- `supabase db query --linked`, pas seulement les migrations locales —
-- la table `users` porte une colonne `auth_id` (uuid) totalement morte,
-- jamais écrite par aucun code applicatif (grep sur src/ et
-- supabase/functions/ : zéro résultat), reliquat d'avant le passage au
-- système actuel basé sur `auth_uid` (text).
--
-- Une policy "Club members only" (FOR ALL, roles public) sur `users`
-- n'a jamais été supprimée et utilise encore `auth_id = auth.uid()`.
-- Comme les policies RLS permissives se combinent en OR (pas en AND),
-- cette policy s'ajoute à users_insert_by_coach/users_update_self au
-- lieu de les remplacer : un compte authentifié quelconque peut
-- s'insérer une ligne `users` avec `auth_id = auth.uid()` (sa propre
-- valeur), et n'importe quel `club_id`/`role` — ce qui contourne
-- entièrement le contrôle "coach de CE club uniquement" de
-- users_insert_by_coach. Une fois cette ligne insérée, elle réactive
-- aussi les policies "Club members only" identiques (mais jusqu'ici
-- mortes, car elles dépendent de la même colonne `auth_id`) sur alerts,
-- athletes, clubs, competition_athletes, competition_results,
-- competitions, injuries, messages, performance_history, records,
-- session_athletes, sessions — donnant accès en lecture/écriture à
-- N'IMPORTE QUEL club. Un athlète peut aussi, plus simplement, changer
-- SON PROPRE rôle en tête via users_update_self (aucune colonne n'y est
-- protégée).
--
-- Correctif : supprime la policy dangereuse + ses 12 équivalentes
-- mortes-mais-dormantes sur les autres tables (chaque table ne garde
-- plus qu'un seul jeu de policies, actif et documenté), et verrouille
-- `role`/`club_id` contre toute auto-modification (trigger, service_role
-- uniquement).
-- ============================================================

-- 1) Nettoyage des policies héritées mortes/dangereuses (aucune n'a de
--    raison de coexister avec les policies "_club" actuelles — chaque
--    table ne doit avoir qu'un seul propriétaire de policy documenté,
--    cf. DoD tâche 6).
DROP POLICY IF EXISTS "Club members only" ON public.alerts;
DROP POLICY IF EXISTS "Club members only" ON public.athletes;
DROP POLICY IF EXISTS "Club members only" ON public.clubs;
DROP POLICY IF EXISTS "Club members only" ON public.competition_athletes;
DROP POLICY IF EXISTS "Club members only" ON public.competition_results;
DROP POLICY IF EXISTS "Club members only" ON public.competitions;
DROP POLICY IF EXISTS "Club members only" ON public.injuries;
DROP POLICY IF EXISTS "Club members only" ON public.messages;
DROP POLICY IF EXISTS "Club members only" ON public.performance_history;
DROP POLICY IF EXISTS "Club members only" ON public.records;
DROP POLICY IF EXISTS "Club members only" ON public.session_athletes;
DROP POLICY IF EXISTS "Club members only" ON public.sessions;
DROP POLICY IF EXISTS "club members only" ON public.users;

-- 2) Nouveaux helpers, même convention que get_my_club_id() (SQL,
--    STABLE, SECURITY DEFINER, search_path fixé) — nécessaires pour
--    distinguer coach/athlète et retrouver sa propre ligne athletes/
--    users sans dupliquer la sous-requête dans chaque policy.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM users
  WHERE lower(trim(auth_uid)) = lower(trim(auth.uid()::text))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_user_id()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM users
  WHERE lower(trim(auth_uid)) = lower(trim(auth.uid()::text))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_athlete_id()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id FROM athletes a
  JOIN users u ON u.id = a.user_id
  WHERE lower(trim(u.auth_uid)) = lower(trim(auth.uid()::text))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_athlete_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_athlete_id() TO authenticated;

-- get_my_club_id() n'a jamais besoin d'être appelée par anon (anon n'a
-- pas de ligne dans `users`, la fonction renvoie toujours NULL pour ce
-- rôle) — advisor "authenticated/anon can execute SECURITY DEFINER".
REVOKE EXECUTE ON FUNCTION public.get_my_club_id() FROM anon;

-- 3) users : verrouille role/club_id contre l'auto-modification.
--    users_update_self (migration 20260725190500) autorise déjà la
--    modification de sa propre ligne sans restreindre les colonnes —
--    un athlète peut aujourd'hui se PATCHer role="head_coach" tout
--    seul. Un trigger (pas une policy) car RLS ne peut pas comparer
--    OLD/NEW colonne par colonne. Bloque uniquement les requêtes REST
--    d'un utilisateur connecté (auth.role() = 'authenticated') — laisse
--    passer service_role (Edge Functions/futur écran admin) ET le
--    contexte migration/SQL editor (auth.role() est alors NULL, hors
--    requête PostgREST), pour ne pas se piéger soi-même en dashboard.
CREATE OR REPLACE FUNCTION public.prevent_users_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.club_id IS DISTINCT FROM OLD.club_id THEN
      RAISE EXCEPTION 'role et club_id ne peuvent être modifiés que par service_role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_prevent_role_self_escalation ON public.users;
CREATE TRIGGER users_prevent_role_self_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_users_role_self_escalation();

-- users_insert_by_coach (migration 20260725190500) laissait un coach
-- (pas head_coach) créer une ligne avec n'importe quel rôle, y compris
-- head_coach/coach, dans son propre club — vérifié dans AthleteList.jsx :
-- le seul insert coach->users existant pose toujours role="athlete",
-- donc resserrer ne casse rien de réel.
DROP POLICY IF EXISTS "users_insert_by_coach" ON public.users;
CREATE POLICY "users_insert_by_coach" ON public.users
  FOR INSERT TO public
  WITH CHECK (
    club_id = get_my_club_id()
    AND get_my_role() IN ('head_coach','coach')
    AND (role = 'athlete' OR get_my_role() = 'head_coach')
  );

-- 4) athlete_wellness : coach voit tout le club (Rapports.jsx),
--    l'athlète ne voit/écrit que ses propres entrées (WellnessModal.jsx,
--    AthleteApp.jsx) — plus d'accès entre coéquipiers.
DROP POLICY IF EXISTS "athlete_wellness_club" ON public.athlete_wellness;

CREATE POLICY "athlete_wellness_coach_read" ON public.athlete_wellness
  FOR SELECT TO public
  USING (club_id = get_my_club_id() AND get_my_role() IN ('head_coach','coach'));

CREATE POLICY "athlete_wellness_self" ON public.athlete_wellness
  FOR ALL TO public
  USING (athlete_id = get_my_athlete_id())
  WITH CHECK (athlete_id = get_my_athlete_id() AND club_id = get_my_club_id());

-- 5) injuries (données médicales) : coach = CRUD sur tout le club
--    (AthleteList.jsx : addInjury/updateInjury/deleteInjury sur tous les
--    athleteIds du club) ; athlète = lecture + signalement de ses
--    propres blessures uniquement (AthleteApp.jsx, InjuryReportModal.jsx),
--    jamais les blessures d'un coéquipier.
DROP POLICY IF EXISTS "injuries_club" ON public.injuries;

CREATE POLICY "injuries_coach_all" ON public.injuries
  FOR ALL TO public
  USING (
    get_my_role() IN ('head_coach','coach')
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = injuries.athlete_id AND a.club_id = get_my_club_id())
  )
  WITH CHECK (
    get_my_role() IN ('head_coach','coach')
    AND EXISTS (SELECT 1 FROM athletes a WHERE a.id = injuries.athlete_id AND a.club_id = get_my_club_id())
  );

CREATE POLICY "injuries_athlete_read_own" ON public.injuries
  FOR SELECT TO public
  USING (athlete_id = get_my_athlete_id());

CREATE POLICY "injuries_athlete_insert_own" ON public.injuries
  FOR INSERT TO public
  WITH CHECK (athlete_id = get_my_athlete_id());

-- 6) push_subscriptions : chacun ne gère que son propre abonnement
--    (athlete_id pour un athlète, user_id pour un coach — les deux
--    colonnes sont posées par usePushNotifications.jsx selon le rôle).
--    L'envoi réel (send-push, weekly-cron) passe par service_role et
--    n'est pas concerné par RLS.
DROP POLICY IF EXISTS "push_subscriptions_club" ON public.push_subscriptions;

CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions
  FOR ALL TO public
  USING (
    (athlete_id IS NOT NULL AND athlete_id = get_my_athlete_id())
    OR (user_id IS NOT NULL AND user_id = get_my_user_id())
  )
  WITH CHECK (
    club_id = get_my_club_id()
    AND (
      (athlete_id IS NOT NULL AND athlete_id = get_my_athlete_id())
      OR (user_id IS NOT NULL AND user_id = get_my_user_id())
    )
  );

-- 7) anon : révoque les droits CRUD hérités par défaut sur les tables
--    métier (aucune page pré-connexion — Login/Signup/ResetPassword —
--    ne fait le moindre supabase.from(...) : signup passe par l'Edge
--    Function signup en service_role, login par supabase.auth). RLS
--    bloquait déjà anon en pratique (get_my_club_id() renvoie NULL sans
--    ligne users), mais laisser le GRANT grand ouvert est un filet de
--    sécurité en moins si une policy future devient trop permissive.
REVOKE INSERT, UPDATE, DELETE, SELECT ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, SELECT ON TABLES FROM anon;

-- 8) search_path non fixé sur les fonctions triggers ajoutées aux
--    tâches 16/18 (advisor "function_search_path_mutable", WARN).
ALTER FUNCTION public.validate_charge_model_version() SET search_path TO 'public';
ALTER FUNCTION public.validate_axis_model_version() SET search_path TO 'public';
ALTER FUNCTION public.stamp_session_athlete_model_version() SET search_path TO 'public';

COMMIT;
