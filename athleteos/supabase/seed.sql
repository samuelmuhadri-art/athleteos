-- ============================================================
-- AthleteOS — supabase/seed.sql
--
-- Exécuté automatiquement par `supabase start`/`supabase db reset` APRÈS
-- toutes les migrations, uniquement en local — jamais par `supabase db
-- push` (qui ne touche que le schéma versionné, pas ce fichier). Sert à
-- recréer, en local, l'état d'infrastructure qui existe en production
-- mais n'a jamais été versionné dans une migration : les buckets de
-- stockage `session-pdfs` et `social-photos` ont été créés à la main
-- dans le dashboard Supabase (voir migrations 20260725113137/
-- 20260727010000 pour leurs policies, qui elles SONT versionnées).
--
-- Sans ce fichier, une instance Supabase locale fraîche (comme celle
-- démarrée en CI par .github/workflows/rls-check.yml, tâche 7) n'aurait
-- aucun bucket, et les tests storage.objects de test_rls_regression.mjs
-- échoueraient pour une raison sans rapport avec RLS ("Bucket not
-- found").
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('session-pdfs', 'session-pdfs', true),
  ('social-photos', 'social-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Tâche 5 — jeu de données fictif minimal (deux clubs, tous les rôles)
--
-- Uniquement des données inventées (aucune donnée réelle) — sert à avoir
-- tout de suite quelque chose à regarder après `supabase start`/`db
-- reset` : deux clubs, un head coach + un coach + deux athlètes dans le
-- premier (pour voir les écrans coach ET athlète), un head coach + un
-- athlète dans le second (pour vérifier l'isolation entre clubs à l'œil,
-- ex: se connecter côté club A ne doit jamais montrer club B).
--
-- Ces lignes n'ont volontairement PAS de compte de connexion réel — les
-- créer directement dans auth.users demanderait de reproduire à la main
-- le hash de mot de passe et le schéma interne de GoTrue, propre à
-- chaque version, fragile et non vérifiable sans instance locale
-- (indisponible sur la machine où ce fichier a été écrit — voir
-- status.md). Pour se connecter en local : voir GUIDE_IA.md
-- ("Créer un compte de test en local"), qui explique comment créer un
-- vrai compte via Studio puis le relier à une des lignes `users`
-- ci-dessous par leur `auth_uid`.
-- ============================================================

DO $$
DECLARE
  v_club_a_id           integer;
  v_club_b_id           integer;
  v_user_a_head_id      integer;
  v_user_a_athlete1_id  integer;
  v_user_a_athlete2_id  integer;
  v_user_b_athlete_id   integer;
  v_athlete_a1_id       integer;
  v_athlete_a2_id       integer;
  v_athlete_b1_id       integer;
  v_session_a1_id       integer;
BEGIN
  INSERT INTO public.clubs (name, invite_code) VALUES ('Club Athlé Démo', 'DEMOAAAA') RETURNING id INTO v_club_a_id;
  INSERT INTO public.clubs (name, invite_code) VALUES ('Club Athlé Concurrent', 'DEMOBBBB') RETURNING id INTO v_club_b_id;

  INSERT INTO public.users (club_id, name, email, role) VALUES (v_club_a_id, 'Camille Dupont (démo head coach)', 'demo-head-coach@athleteos.local', 'head_coach') RETURNING id INTO v_user_a_head_id;
  INSERT INTO public.users (club_id, name, email, role) VALUES (v_club_a_id, 'Sacha Martin (démo coach)', 'demo-coach@athleteos.local', 'coach');
  INSERT INTO public.users (club_id, name, email, role) VALUES (v_club_a_id, 'Lina Bernard (démo athlète)', 'demo-athlete-1@athleteos.local', 'athlete') RETURNING id INTO v_user_a_athlete1_id;
  INSERT INTO public.users (club_id, name, email, role) VALUES (v_club_a_id, 'Yanis Roche (démo athlète)', 'demo-athlete-2@athleteos.local', 'athlete') RETURNING id INTO v_user_a_athlete2_id;
  INSERT INTO public.users (club_id, name, email, role) VALUES (v_club_b_id, 'Nora Petit (démo head coach club B)', 'demo-head-coach-b@athleteos.local', 'head_coach');
  INSERT INTO public.users (club_id, name, email, role) VALUES (v_club_b_id, 'Ilan Faure (démo athlète club B)', 'demo-athlete-b@athleteos.local', 'athlete') RETURNING id INTO v_user_b_athlete_id;

  INSERT INTO public.athletes (club_id, name, age, main_discipline, group_name, user_id) VALUES (v_club_a_id, 'Lina Bernard', 17, '100m', 'Groupe élite', v_user_a_athlete1_id) RETURNING id INTO v_athlete_a1_id;
  INSERT INTO public.athletes (club_id, name, age, main_discipline, group_name, user_id) VALUES (v_club_a_id, 'Yanis Roche', 19, 'Longueur', 'Groupe élite', v_user_a_athlete2_id) RETURNING id INTO v_athlete_a2_id;
  INSERT INTO public.athletes (club_id, name, age, main_discipline, group_name, user_id) VALUES (v_club_b_id, 'Ilan Faure', 18, '400m', 'Groupe performance', v_user_b_athlete_id) RETURNING id INTO v_athlete_b1_id;

  INSERT INTO public.sessions (club_id, title, category, week, duration_minutes, session_date, created_by)
    VALUES (v_club_a_id, 'Séance vitesse', 'sprint', 1, 60, current_date, v_user_a_head_id) RETURNING id INTO v_session_a1_id;

  INSERT INTO public.session_athletes (session_id, athlete_id, rpe, status) VALUES (v_session_a1_id, v_athlete_a1_id, 7, 'terminée');
  INSERT INTO public.session_athletes (session_id, athlete_id, rpe, status) VALUES (v_session_a1_id, v_athlete_a2_id, 6, 'terminée');

  INSERT INTO public.athlete_wellness (athlete_id, club_id, date, sleep, energy, soreness, mood, stress)
    VALUES (v_athlete_a1_id, v_club_a_id, current_date, 4, 4, 3, 4, 3);

  INSERT INTO public.injuries (athlete_id, name, location, intensity, status, start_date)
    VALUES (v_athlete_a2_id, 'Douleur ischio-jambier', 'Cuisse droite', 3, 'actif', current_date);

  INSERT INTO public.records (athlete_id, discipline, sb, pr, pr_date)
    VALUES (v_athlete_a1_id, '100m', '12.10', '11.95', current_date);

  INSERT INTO public.athlete_goals (athlete_id, club_id, discipline, target_value, deadline)
    VALUES (v_athlete_a1_id, v_club_a_id, '100m', '11.80', current_date + interval '3 months');
END $$;
