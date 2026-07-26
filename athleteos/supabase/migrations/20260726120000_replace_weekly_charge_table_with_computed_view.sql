BEGIN;

-- weekly_charge existait comme TABLE (athlete_id, week, raw_load) mais rien
-- dans le code n'y écrivait jamais — vérifié : 0 ligne en base. Le seul
-- lecteur (Competitions.jsx) recevait donc systématiquement une charge vide,
-- alors que tous les autres écrans (Dashboard, AthleteList, Performances,
-- ChargeView, AthleteApp) recalculaient la même chose côté client à partir
-- de sessions + session_athletes, chacun avec sa propre implémentation JS.
--
-- Remplacée ici par une VUE qui calcule la charge hebdomadaire directement
-- en base, avec la même formule que src/utils/trainingLoad.js
-- (computeSessionLoad = round(durée × RPE × coefficient / 10), sommée par
-- athlète/semaine, séances sans RPE exclues). Le nom et les colonnes restent
-- identiques (athlete_id, week, raw_load) : aucun changement requis côté
-- frontend pour Competitions.jsx.
--
-- ⚠️ Les coefficients ci-dessous DOIVENT rester synchronisés avec
-- LOAD_COEFFICIENTS dans athleteos/src/utils/trainingLoad.js. C'est la
-- même limite qu'on avait déjà côté JS avant l'unification (#3) : une
-- seule table de coefficients, dupliquée une fois côté SQL faute de
-- mécanisme partagé JS<->Postgres pour l'instant.
--
-- security_invoker = true : la vue applique les policies RLS des tables
-- sous-jacentes (sessions, session_athletes) pour l'utilisateur courant,
-- au lieu de s'exécuter avec les droits du propriétaire de la vue —
-- c'est ce qui préserve le cloisonnement par club.

DROP TABLE IF EXISTS public.weekly_charge;

CREATE VIEW public.weekly_charge
WITH (security_invoker = true)
AS
SELECT
  sa.athlete_id,
  s.week,
  ROUND(
    SUM(
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
      )
    ) / 10.0
  )::integer AS raw_load
FROM public.session_athletes sa
JOIN public.sessions s ON s.id = sa.session_id
WHERE sa.rpe IS NOT NULL
  AND s.duration_minutes IS NOT NULL
  AND s.week IS NOT NULL
GROUP BY sa.athlete_id, s.week;

GRANT SELECT ON public.weekly_charge TO authenticated;

COMMIT;
