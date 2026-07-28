BEGIN;

-- ============================================================
-- Tâche 7 — socle de schéma antérieur au suivi des migrations
--
-- Les tables applicatives (users, clubs, athletes, sessions, records...),
-- leurs policies RLS "_club"/"Club members only" d'origine et la fonction
-- get_my_club_id() ont été créées à la main dans le dashboard Supabase
-- avant que ce projet ne commence à versionner ses migrations (la
-- première migration suivie, 20260725111554, active RLS sur des tables
-- qui "ont déjà les bonnes policies club-scoped" — donc CES policies
-- existaient déjà, hors historique).
--
-- Conséquence concrète : une base Supabase LOCALE fraîche (CI, tâche 7)
-- qui ne rejoue que les migrations existantes n'a aucune de ces tables —
-- `ALTER TABLE public.users ENABLE ROW LEVEL SECURITY` échoue dès la
-- toute première migration ("relation does not exist"). Cette migration
-- reconstruit fidèlement cet état d'origine, à partir d'une inspection
-- en lecture seule de la base réelle (colonnes/contraintes/policies via
-- `supabase db query --linked`), pour que l'historique complet des
-- migrations puisse être rejoué de zéro, en local comme en CI.
--
-- Portée volontairement limitée à ce qui est nécessaire pour que TOUTES
-- les migrations suivantes s'appliquent sans erreur et que les tests RLS
-- reflètent le comportement réel :
--   - colonnes/types/contraintes = copie exacte de la base réelle,
--     MOINS les colonnes ajoutées plus tard par une migration existante
--     (ex: athlete_performances.breakdown, session_athletes.model_version,
--     clubs.invite_code) — ces migrations les ajoutent déjà via
--     `ADD COLUMN IF NOT EXISTS`, donc les omettre ici est correct et
--     évite toute divergence avec l'historique versionné.
--   - policies : uniquement celles qui existaient AVANT la première
--     migration suivie (confirmées par lecture des commentaires de
--     20260725111554/112151, qui les modifient) — pas de tentative de
--     deviner des policies déjà mortes/déjà supprimées dont la recréation
--     n'apporterait rien.
--   - grants anon/authenticated : aucune migration suivie n'accorde
--     jamais explicitement de droits à `authenticated` (seul
--     `service_role` l'est, migrations 20260725184500/184900) — pourtant
--     `authenticated` a bien ces droits en production. Reconstruit ici
--     explicitement (plutôt que de dépendre du réglage local
--     `auto_expose_new_tables`, qui est marqué obsolète et sera retiré du
--     CLI le 2026-10-30).
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────────────────

CREATE TABLE public.clubs (
  id   serial PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.users (
  id       serial PRIMARY KEY,
  club_id  integer REFERENCES public.clubs(id),
  name     text,
  email    text UNIQUE,
  role     text CHECK (role = ANY (ARRAY['head_coach','coach','athlete'])),
  auth_uid text,
  auth_id  uuid UNIQUE
);

-- Fonction utilisée par (quasi) toutes les policies plus bas — DOIT venir
-- après `users` : pour une fonction LANGUAGE sql, Postgres résout et
-- vérifie les tables référencées dès la création (contrairement à
-- plpgsql, où le corps n'est vérifié qu'à la première exécution) — la
-- créer avant que `users` existe échoue immédiatement ("relation "users"
-- does not exist"). C'est exactement ce qui a fait échouer le 1er essai
-- de cette migration en CI.
CREATE OR REPLACE FUNCTION public.get_my_club_id()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT club_id FROM users
  WHERE lower(trim(auth_uid)) = lower(trim(auth.uid()::text))
  LIMIT 1;
$$;

CREATE TABLE public.athletes (
  id             serial PRIMARY KEY,
  club_id        integer REFERENCES public.clubs(id),
  name           text,
  age            integer,
  main_discipline text,
  group_name     text,
  profile_data   jsonb,
  user_id        integer REFERENCES public.users(id)
);

CREATE TABLE public.sessions (
  id               serial PRIMARY KEY,
  club_id          integer REFERENCES public.clubs(id),
  title            text,
  day              text,
  time             text,
  type             text,
  category         text,
  description      text,
  instructions     text,
  week             integer,
  load_weight      numeric,
  pdf_url          text,
  duration_minutes integer,
  created_by       integer REFERENCES public.users(id),
  session_date     date
);

CREATE TABLE public.session_athletes (
  id         serial PRIMARY KEY,
  session_id integer REFERENCES public.sessions(id) ON DELETE CASCADE,
  athlete_id integer REFERENCES public.athletes(id) ON DELETE CASCADE,
  status     text,
  feeling    integer,
  fatigue    integer,
  comment    text,
  rpe        integer
);

CREATE TABLE public.athlete_wellness (
  id         bigserial PRIMARY KEY,
  athlete_id integer NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  club_id    integer,
  date       date,
  sleep      integer CHECK (sleep BETWEEN 1 AND 5),
  energy     integer CHECK (energy BETWEEN 1 AND 5),
  soreness   integer CHECK (soreness BETWEEN 1 AND 5),
  mood       integer CHECK (mood BETWEEN 1 AND 5),
  stress     integer CHECK (stress BETWEEN 1 AND 5),
  notes      text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (athlete_id, date)
);

CREATE TABLE public.injuries (
  id         serial PRIMARY KEY,
  athlete_id integer REFERENCES public.athletes(id) ON DELETE CASCADE,
  name       text,
  location   text,
  intensity  integer,
  status     text,
  start_date date,
  notes      text
);

CREATE TABLE public.push_subscriptions (
  id         bigserial PRIMARY KEY,
  athlete_id integer REFERENCES public.athletes(id) ON DELETE CASCADE,
  club_id    integer,
  endpoint   text UNIQUE,
  p256dh     text,
  auth       text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  user_id    integer
);

CREATE TABLE public.athlete_goals (
  id           bigserial PRIMARY KEY,
  athlete_id   integer NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  club_id      integer NOT NULL REFERENCES public.clubs(id),
  discipline   text NOT NULL,
  target_value text NOT NULL,
  deadline     date,
  description  text,
  achieved     boolean DEFAULT false,
  achieved_at  date,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE public.athlete_notifications (
  id          bigserial PRIMARY KEY,
  athlete_id  integer NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  club_id     integer NOT NULL REFERENCES public.clubs(id),
  type        text NOT NULL,
  title       text NOT NULL,
  description text,
  is_read     boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE public.athlete_performances (
  id               bigserial PRIMARY KEY,
  athlete_id       integer NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  club_id          integer NOT NULL REFERENCES public.clubs(id),
  discipline       text NOT NULL,
  value            text NOT NULL,
  discipline_type  text NOT NULL,
  performance_date date NOT NULL,
  context          text,
  source           text DEFAULT 'athlete',
  competition_id   integer,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE public.alerts (
  id          serial PRIMARY KEY,
  club_id     integer REFERENCES public.clubs(id),
  athlete_id  integer REFERENCES public.athletes(id) ON DELETE CASCADE,
  type        text,
  title       text,
  description text,
  severity    text,
  is_read     boolean DEFAULT false,
  created_at  timestamp DEFAULT now()
);

CREATE TABLE public.competitions (
  id       serial PRIMARY KEY,
  club_id  integer REFERENCES public.clubs(id),
  name     text,
  date     date,
  location text,
  type     text
);

ALTER TABLE public.athlete_performances
  ADD CONSTRAINT athlete_performances_competition_id_fkey
  FOREIGN KEY (competition_id) REFERENCES public.competitions(id);

CREATE TABLE public.competition_athletes (
  id             serial PRIMARY KEY,
  competition_id integer REFERENCES public.competitions(id) ON DELETE CASCADE,
  athlete_id     integer REFERENCES public.athletes(id) ON DELETE CASCADE,
  planned_event  text
);

CREATE TABLE public.competition_results (
  id             serial PRIMARY KEY,
  competition_id integer REFERENCES public.competitions(id) ON DELETE CASCADE,
  athlete_id     integer REFERENCES public.athletes(id) ON DELETE CASCADE,
  event          text,
  result         text,
  context        text
);

CREATE TABLE public.records (
  id         serial PRIMARY KEY,
  athlete_id integer REFERENCES public.athletes(id) ON DELETE CASCADE,
  discipline text,
  sb         text,
  pr         text,
  pr_date    date
);

CREATE TABLE public.performance_history (
  id         serial PRIMARY KEY,
  athlete_id integer REFERENCES public.athletes(id) ON DELETE CASCADE,
  month      date,
  value      numeric
);

CREATE TABLE public.messages (
  id          serial PRIMARY KEY,
  sender_id   integer REFERENCES public.users(id),
  receiver_id integer REFERENCES public.users(id),
  content     text,
  is_read     boolean DEFAULT false,
  created_at  timestamp DEFAULT now()
);

CREATE TABLE public.social_posts (
  id         bigserial PRIMARY KEY,
  athlete_id integer NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  club_id    integer NOT NULL REFERENCES public.clubs(id),
  session_id integer REFERENCES public.sessions(id),
  content    text NOT NULL,
  image_url  text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.social_comments (
  id         bigserial PRIMARY KEY,
  post_id    integer NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  athlete_id integer NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.social_reactions (
  id         bigserial PRIMARY KEY,
  post_id    integer NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  athlete_id integer NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  emoji      text NOT NULL DEFAULT '🔥',
  created_at timestamptz DEFAULT now(),
  UNIQUE (post_id, athlete_id)
);

-- weekly_charge existait comme TABLE à ce stade (remplacée par une vue
-- dans la migration 20260726120000, qui la DROP avant de la recréer) —
-- structure minimale, jamais lue avant d'être droppée dans l'historique.
CREATE TABLE public.weekly_charge (
  athlete_id integer,
  week       integer,
  raw_load   integer
);

-- ── RLS : activation + policies d'origine (avant tout durcissement) ────────
-- Convention observée sur la vraie base : deux policies FOR ALL par table,
-- une ancienne ("Club members only", role authenticated, via une
-- sous-requête sur users.auth_id — colonne devenue orpheline) et une plus
-- récente ("<table>_club", role public, via get_my_club_id()). Les deux
-- coexistaient déjà en production avant le début du suivi des migrations
-- (c'est exactement ce que la tâche 6 a corrigé plus tard dans l'historique
-- — cette migration ne fait que reproduire l'état de départ pour que
-- l'historique complet rejoue correctement).

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members only" ON public.clubs FOR SELECT TO authenticated
  USING (id = (SELECT u.club_id FROM public.users u WHERE u.auth_id = auth.uid()));
CREATE POLICY "clubs_own" ON public.clubs FOR SELECT TO public
  USING (id = get_my_club_id());

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- Casse exacte confirmée sur la vraie base (tâche 6) : "club members only"
-- en minuscules ici, contrairement aux 12 autres tables ci-dessous qui
-- utilisent toutes "Club members only" — la migration 20260728130618 (tâche
-- 6) cible précisément ce nom, sensible à la casse, pour la supprimer.
CREATE POLICY "club members only" ON public.users FOR ALL TO public
  USING (auth_id = auth.uid());

ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members only" ON public.athletes FOR ALL TO authenticated
  USING (club_id = (SELECT u.club_id FROM public.users u WHERE (u.auth_uid)::uuid = auth.uid()))
  WITH CHECK (club_id = (SELECT u.club_id FROM public.users u WHERE (u.auth_uid)::uuid = auth.uid()));
CREATE POLICY "athletes_club" ON public.athletes FOR ALL TO public
  USING (club_id = get_my_club_id());

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members only" ON public.sessions FOR ALL TO authenticated
  USING (club_id = (SELECT u.club_id FROM public.users u WHERE u.auth_id = auth.uid()))
  WITH CHECK (club_id = (SELECT u.club_id FROM public.users u WHERE u.auth_id = auth.uid()));
CREATE POLICY "sessions_club" ON public.sessions FOR ALL TO public
  USING (club_id = get_my_club_id());

ALTER TABLE public.session_athletes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members only" ON public.session_athletes FOR ALL TO authenticated
  USING (session_id IN (SELECT s.id FROM public.sessions s JOIN public.users u ON u.club_id = s.club_id WHERE u.auth_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT s.id FROM public.sessions s JOIN public.users u ON u.club_id = s.club_id WHERE u.auth_id = auth.uid()));
CREATE POLICY "session_athletes_club" ON public.session_athletes FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_athletes.session_id AND s.club_id = get_my_club_id()));

CREATE POLICY "goals_club" ON public.athlete_goals FOR ALL TO public
  USING (club_id = get_my_club_id());
ALTER TABLE public.athlete_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_notifs" ON public.athlete_notifications FOR ALL TO public
  USING (club_id = get_my_club_id());
-- RLS activée par la migration 20260725111554 (pas ici) : cette table avait
-- une policy USING(true) en plus, supprimée par cette même migration.

CREATE POLICY "performances_club" ON public.athlete_performances FOR ALL TO public
  USING (club_id = get_my_club_id());
ALTER TABLE public.athlete_performances ENABLE ROW LEVEL SECURITY;

-- athlete_wellness et push_subscriptions : RLS + policy créées par la
-- migration 20260725111554 elle-même ("no policy existed at all") — rien
-- à faire ici, juste les tables nues.

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members only" ON public.alerts FOR ALL TO authenticated
  USING (club_id = (SELECT u.club_id FROM public.users u WHERE u.auth_id = auth.uid()))
  WITH CHECK (club_id = (SELECT u.club_id FROM public.users u WHERE u.auth_id = auth.uid()));
CREATE POLICY "alerts_club" ON public.alerts FOR ALL TO public
  USING (club_id = get_my_club_id());

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members only" ON public.competitions FOR ALL TO authenticated
  USING (club_id = (SELECT u.club_id FROM public.users u WHERE u.auth_id = auth.uid()))
  WITH CHECK (club_id = (SELECT u.club_id FROM public.users u WHERE u.auth_id = auth.uid()));
CREATE POLICY "competitions_club" ON public.competitions FOR ALL TO public
  USING (club_id = get_my_club_id());

ALTER TABLE public.competition_athletes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members only" ON public.competition_athletes FOR ALL TO authenticated
  USING (competition_id IN (SELECT c.id FROM public.competitions c JOIN public.users u ON u.club_id = c.club_id WHERE u.auth_id = auth.uid()))
  WITH CHECK (competition_id IN (SELECT c.id FROM public.competitions c JOIN public.users u ON u.club_id = c.club_id WHERE u.auth_id = auth.uid()));
CREATE POLICY "competition_athletes_club" ON public.competition_athletes FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = competition_athletes.competition_id AND c.club_id = get_my_club_id()));

ALTER TABLE public.competition_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members only" ON public.competition_results FOR ALL TO authenticated
  USING (competition_id IN (SELECT c.id FROM public.competitions c JOIN public.users u ON u.club_id = c.club_id WHERE u.auth_id = auth.uid()))
  WITH CHECK (competition_id IN (SELECT c.id FROM public.competitions c JOIN public.users u ON u.club_id = c.club_id WHERE u.auth_id = auth.uid()));
CREATE POLICY "competition_results_club" ON public.competition_results FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM public.competitions c WHERE c.id = competition_results.competition_id AND c.club_id = get_my_club_id()));

ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members only" ON public.injuries FOR ALL TO authenticated
  USING (athlete_id IN (SELECT a.id FROM public.athletes a JOIN public.users u ON u.club_id = a.club_id WHERE u.auth_id = auth.uid()))
  WITH CHECK (athlete_id IN (SELECT a.id FROM public.athletes a JOIN public.users u ON u.club_id = a.club_id WHERE u.auth_id = auth.uid()));
CREATE POLICY "injuries_club" ON public.injuries FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = injuries.athlete_id AND a.club_id = get_my_club_id()));

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members only" ON public.records FOR ALL TO authenticated
  USING (athlete_id IN (SELECT a.id FROM public.athletes a JOIN public.users u ON u.club_id = a.club_id WHERE u.auth_id = auth.uid()))
  WITH CHECK (athlete_id IN (SELECT a.id FROM public.athletes a JOIN public.users u ON u.club_id = a.club_id WHERE u.auth_id = auth.uid()));
CREATE POLICY "records_club" ON public.records FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = records.athlete_id AND a.club_id = get_my_club_id()));

ALTER TABLE public.performance_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members only" ON public.performance_history FOR ALL TO authenticated
  USING (athlete_id IN (SELECT a.id FROM public.athletes a JOIN public.users u ON u.club_id = a.club_id WHERE u.auth_id = auth.uid()))
  WITH CHECK (athlete_id IN (SELECT a.id FROM public.athletes a JOIN public.users u ON u.club_id = a.club_id WHERE u.auth_id = auth.uid()));
CREATE POLICY "perf_history_club" ON public.performance_history FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = performance_history.athlete_id AND a.club_id = get_my_club_id()));

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members only" ON public.messages FOR ALL TO authenticated
  USING (sender_id = (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid()) OR receiver_id = (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid()))
  WITH CHECK (sender_id = (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid()) OR receiver_id = (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid()));
CREATE POLICY "messages_own" ON public.messages FOR ALL TO public
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = messages.sender_id AND u.auth_uid = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = messages.receiver_id AND u.auth_uid = auth.uid()::text)
  );

CREATE POLICY "posts_club" ON public.social_posts FOR ALL TO public
  USING (club_id = get_my_club_id());
CREATE POLICY "comments_club" ON public.social_comments FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = social_comments.post_id AND p.club_id = get_my_club_id()));
CREATE POLICY "reactions_club" ON public.social_reactions FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = social_reactions.post_id AND p.club_id = get_my_club_id()));
-- RLS de social_comments/social_posts/social_reactions/weekly_charge
-- activée par la migration 20260725111554 (pas ici) : "already have correct
-- club-scoped policies — just turn RLS on". (users l'est déjà ci-dessus —
-- l'activer une seconde fois dans cette même migration ne pose aucun
-- problème, ALTER TABLE ... ENABLE ROW LEVEL SECURITY est idempotent.)

-- ── Fonctions applicatives pré-existantes (référencées par des migrations
--    suivies qui les modifient : REVOKE, event trigger) ───────────────────
CREATE OR REPLACE FUNCTION public.create_coach_alert(
  p_club_id integer, p_athlete_id integer, p_type text, p_title text,
  p_description text, p_severity text DEFAULT 'légère'::text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO alerts (club_id, athlete_id, type, title, description, severity, is_read)
  VALUES (p_club_id, p_athlete_id, p_type, p_title, p_description, p_severity, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
     END IF;
  END LOOP;
END;
$$;

-- ── Grants : aucune migration suivie n'accorde jamais rien explicitement à
--    `authenticated` (seul service_role l'est plus loin dans l'historique),
--    pourtant ce rôle a bien ces droits en production — comportement par
--    défaut de Supabase Cloud à la création du projet, non versionné.
--    Reconstruit explicitement ici (plutôt que de dépendre du réglage local
--    `auto_expose_new_tables`, obsolète, retiré du CLI le 2026-10-30).
--    anon reçoit les mêmes droits qu'à l'origine — une migration plus loin
--    dans l'historique (tâche 6) les révoque, fidèle à ce qui s'est
--    vraiment passé en production.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

COMMIT;
