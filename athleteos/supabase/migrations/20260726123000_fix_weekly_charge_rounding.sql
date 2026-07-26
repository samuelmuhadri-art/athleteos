BEGIN;

-- La version initiale de la vue weekly_charge (20260726120000) arrondissait
-- UNE FOIS sur la somme de la semaine (ROUND(SUM(...))). Mais
-- src/utils/trainingLoad.js arrondit PAR SÉANCE (computeSessionLoad) puis
-- somme les charges déjà arrondies (computeWeeklyLoadFromSessions). Les deux
-- ordres d'opération peuvent diverger de ±1 selon les valeurs — exactement
-- le type d'écart client/serveur que la vue est censée éliminer. Corrigé
-- pour arrondir par ligne (par séance-athlète) avant de sommer, comme le JS.

CREATE OR REPLACE VIEW public.weekly_charge
WITH (security_invoker = true)
AS
SELECT
  sa.athlete_id,
  s.week,
  SUM(
    ROUND(
      s.duration_minutes * sa.rpe * (
        CASE s.category
          WHEN 'force'        THEN 1.3
          WHEN 'sprint'       THEN 1.1
          WHEN 'haies'        THEN 1.1
          WHEN 'lancer'       THEN 1.0
          WHEN 'saut'         THEN 1.0
          WHEN 'endurance'    THEN 0.9
          WHEN 'technique'    THEN 0.7
          WHEN 'mobilite'     THEN 0.4
          WHEN 'recuperation' THEN 0.3
          ELSE 1.0
        END
      ) / 10.0
    )
  )::integer AS raw_load
FROM public.session_athletes sa
JOIN public.sessions s ON s.id = sa.session_id
WHERE sa.rpe IS NOT NULL
  AND s.duration_minutes IS NOT NULL
  AND s.week IS NOT NULL
GROUP BY sa.athlete_id, s.week;

GRANT SELECT ON public.weekly_charge TO authenticated;

COMMIT;
