BEGIN;

-- Une compétition est visible par tous les coachs de son club, mais par un
-- athlète uniquement lorsqu'une ligne competition_athletes l'y inscrit.
-- SECURITY DEFINER évite une récursion entre les policies de competitions et
-- competition_athletes ; le résultat reste entièrement dérivé de auth.uid().
CREATE OR REPLACE FUNCTION public.can_view_competition(p_competition_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.competitions competition
    WHERE competition.id = p_competition_id
      AND competition.club_id = public.get_my_club_id()
      AND (
        public.get_my_role() IN ('head_coach', 'coach')
        OR EXISTS (
          SELECT 1
          FROM public.competition_athletes assignment
          WHERE assignment.competition_id = competition.id
            AND assignment.athlete_id = public.get_my_athlete_id()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_competition(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_competition(integer) TO authenticated;

DROP POLICY IF EXISTS "competitions_club" ON public.competitions;
DROP POLICY IF EXISTS "competitions_select_visible" ON public.competitions;
DROP POLICY IF EXISTS "competitions_coach_insert" ON public.competitions;
DROP POLICY IF EXISTS "competitions_coach_update" ON public.competitions;
DROP POLICY IF EXISTS "competitions_coach_delete" ON public.competitions;

CREATE POLICY "competitions_select_visible" ON public.competitions
  FOR SELECT TO authenticated
  USING (public.can_view_competition(id));

CREATE POLICY "competitions_coach_insert" ON public.competitions
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = public.get_my_club_id()
    AND public.get_my_role() IN ('head_coach', 'coach')
  );

CREATE POLICY "competitions_coach_update" ON public.competitions
  FOR UPDATE TO authenticated
  USING (
    club_id = public.get_my_club_id()
    AND public.get_my_role() IN ('head_coach', 'coach')
  )
  WITH CHECK (
    club_id = public.get_my_club_id()
    AND public.get_my_role() IN ('head_coach', 'coach')
  );

CREATE POLICY "competitions_coach_delete" ON public.competitions
  FOR DELETE TO authenticated
  USING (
    club_id = public.get_my_club_id()
    AND public.get_my_role() IN ('head_coach', 'coach')
  );

DROP POLICY IF EXISTS "competition_athletes_club" ON public.competition_athletes;
DROP POLICY IF EXISTS "competition_athletes_select_visible" ON public.competition_athletes;
DROP POLICY IF EXISTS "competition_athletes_coach_insert" ON public.competition_athletes;
DROP POLICY IF EXISTS "competition_athletes_coach_update" ON public.competition_athletes;
DROP POLICY IF EXISTS "competition_athletes_coach_delete" ON public.competition_athletes;

CREATE POLICY "competition_athletes_select_visible" ON public.competition_athletes
  FOR SELECT TO authenticated
  USING (
    (
      public.get_my_role() IN ('head_coach', 'coach')
      AND public.can_view_competition(competition_id)
    )
    OR (
      athlete_id = public.get_my_athlete_id()
      AND public.can_view_competition(competition_id)
    )
  );

CREATE POLICY "competition_athletes_coach_insert" ON public.competition_athletes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() IN ('head_coach', 'coach')
    AND EXISTS (
      SELECT 1 FROM public.competitions competition
      WHERE competition.id = competition_id
        AND competition.club_id = public.get_my_club_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.athletes athlete
      WHERE athlete.id = athlete_id
        AND athlete.club_id = public.get_my_club_id()
    )
  );

CREATE POLICY "competition_athletes_coach_update" ON public.competition_athletes
  FOR UPDATE TO authenticated
  USING (
    public.get_my_role() IN ('head_coach', 'coach')
    AND public.can_view_competition(competition_id)
  )
  WITH CHECK (
    public.get_my_role() IN ('head_coach', 'coach')
    AND EXISTS (
      SELECT 1 FROM public.competitions competition
      WHERE competition.id = competition_id
        AND competition.club_id = public.get_my_club_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.athletes athlete
      WHERE athlete.id = athlete_id
        AND athlete.club_id = public.get_my_club_id()
    )
  );

CREATE POLICY "competition_athletes_coach_delete" ON public.competition_athletes
  FOR DELETE TO authenticated
  USING (
    public.get_my_role() IN ('head_coach', 'coach')
    AND public.can_view_competition(competition_id)
  );

DROP POLICY IF EXISTS "competition_results_club" ON public.competition_results;
DROP POLICY IF EXISTS "competition_results_select_visible" ON public.competition_results;
DROP POLICY IF EXISTS "competition_results_coach_insert" ON public.competition_results;
DROP POLICY IF EXISTS "competition_results_coach_update" ON public.competition_results;
DROP POLICY IF EXISTS "competition_results_coach_delete" ON public.competition_results;

CREATE POLICY "competition_results_select_visible" ON public.competition_results
  FOR SELECT TO authenticated
  USING (
    (
      public.get_my_role() IN ('head_coach', 'coach')
      AND public.can_view_competition(competition_id)
    )
    OR (
      athlete_id = public.get_my_athlete_id()
      AND public.can_view_competition(competition_id)
    )
  );

CREATE POLICY "competition_results_coach_insert" ON public.competition_results
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() IN ('head_coach', 'coach')
    AND EXISTS (
      SELECT 1 FROM public.competitions competition
      WHERE competition.id = competition_id
        AND competition.club_id = public.get_my_club_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.athletes athlete
      WHERE athlete.id = athlete_id
        AND athlete.club_id = public.get_my_club_id()
    )
  );

CREATE POLICY "competition_results_coach_update" ON public.competition_results
  FOR UPDATE TO authenticated
  USING (
    public.get_my_role() IN ('head_coach', 'coach')
    AND public.can_view_competition(competition_id)
  )
  WITH CHECK (
    public.get_my_role() IN ('head_coach', 'coach')
    AND public.can_view_competition(competition_id)
    AND athlete_id IN (
      SELECT athlete.id FROM public.athletes athlete
      WHERE athlete.club_id = public.get_my_club_id()
    )
  );

CREATE POLICY "competition_results_coach_delete" ON public.competition_results
  FOR DELETE TO authenticated
  USING (
    public.get_my_role() IN ('head_coach', 'coach')
    AND public.can_view_competition(competition_id)
  );

-- Ce RPC valide déjà que le coach agit dans son club ou que l'athlète ne
-- s'inscrit que lui-même. Il doit contourner les droits INSERT directs, qui
-- sont désormais réservés aux coachs.
ALTER FUNCTION public.create_competition_with_athletes(text, date, text, text, jsonb, text)
  SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.create_competition_with_athletes(text, date, text, text, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_competition_with_athletes(text, date, text, text, jsonb, text)
  TO authenticated;

COMMIT;
