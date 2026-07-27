BEGIN;

-- ============================================================
-- Tâche 16 — unifier et versionner les coefficients de charge
--
-- Problème (déjà signalé en commentaire dans les migrations précédentes,
-- 20260726120000/123000) : les coefficients de charge par catégorie
-- (LOAD_COEFFICIENTS) sont dupliqués en dur à deux endroits — le module JS
-- trainingLoad.js et la vue SQL weekly_charge — sans aucun mécanisme pour
-- les garder synchronisés, et sans aucune notion de version : la vue
-- recalcule TOUJOURS avec les coefficients actuels, donc les changer aurait
-- silencieusement modifié l'historique de TOUTES les semaines passées.
--
-- Solution : une table canonique versionnée (charge_model_versions), et
-- chaque ligne session_athletes qui reçoit un RPE est timbrée avec la
-- version active AU MOMENT de la saisie (trigger, pas le code applicatif —
-- ne peut pas être oublié dans un futur écran d'écriture). La vue
-- weekly_charge calcule désormais chaque ligne avec LA VERSION DE CETTE
-- LIGNE, jamais "la version actuelle" : changer la version active à
-- l'avenir n'altère plus les charges déjà calculées.
-- ============================================================

-- 1) Table canonique versionnée des coefficients (convention de coaching
--    AthleteOS, pas des valeurs publiées — voir trainingLoad.js).
CREATE TABLE public.charge_model_versions (
  version           text PRIMARY KEY,
  load_coefficients jsonb NOT NULL,
  recovery_hours    jsonb NOT NULL,
  is_active         boolean NOT NULL DEFAULT false,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        text  -- users.id (texte pour rester cohérent avec le reste du schéma) de l'auteur du changement, une fois qu'un écran d'édition existera. NULL pour les versions créées hors app (migration, admin DB).
);

-- Une seule version active à la fois — le trigger de session_athletes (plus
-- bas) suppose qu'il en existe au plus une.
CREATE UNIQUE INDEX charge_model_versions_single_active
  ON public.charge_model_versions (is_active)
  WHERE is_active;

ALTER TABLE public.charge_model_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "charge_model_versions_read" ON public.charge_model_versions
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.charge_model_versions TO authenticated;
-- Pas de policy d'écriture pour authenticated : tant qu'aucun écran coach ne
-- permet de créer une version, seule une action directe en base (dashboard/
-- service_role) peut le faire — "configuration coach uniquement dans des
-- bornes" nécessite un écran dédié, hors périmètre de cette tâche (voir
-- status.md). Le contrôle des bornes ci-dessous s'applique déjà à ce
-- chemin, prêt pour quand cet écran existera.

-- 2) Bornes : une valeur de coefficient ou de récupération manifestement
--    aberrante (ex: coefficient 50, récupération de 0h ou 10000h) ne doit
--    jamais pouvoir être enregistrée, qui que ce soit qui écrive la ligne.
CREATE OR REPLACE FUNCTION public.validate_charge_model_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  k text;
  v jsonb;
  n numeric;
BEGIN
  FOR k, v IN SELECT * FROM jsonb_each(NEW.load_coefficients) LOOP
    IF jsonb_typeof(v) <> 'number' THEN
      RAISE EXCEPTION 'load_coefficients.% doit être un nombre (reçu: %)', k, v;
    END IF;
    n := (v#>>'{}')::numeric;
    IF n < 0.1 OR n > 3.0 THEN
      RAISE EXCEPTION 'load_coefficients.% doit être entre 0.1 et 3.0 (reçu: %)', k, n;
    END IF;
  END LOOP;

  FOR k, v IN SELECT * FROM jsonb_each(NEW.recovery_hours) LOOP
    IF jsonb_typeof(v) <> 'number' THEN
      RAISE EXCEPTION 'recovery_hours.% doit être un nombre (reçu: %)', k, v;
    END IF;
    n := (v#>>'{}')::numeric;
    IF n < 1 OR n > 168 THEN
      RAISE EXCEPTION 'recovery_hours.% doit être entre 1 et 168 heures (reçu: %)', k, n;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER charge_model_versions_validate
  BEFORE INSERT OR UPDATE ON public.charge_model_versions
  FOR EACH ROW EXECUTE FUNCTION public.validate_charge_model_version();

-- 3) Version initiale — valeurs IDENTIQUES à celles déjà en dur dans
--    trainingLoad.js et l'ancienne vue weekly_charge : ce n'est pas un
--    changement de modèle, seulement le fait de lui donner un nom et de le
--    rendre canonique. Aucun score existant ne change de valeur.
INSERT INTO public.charge_model_versions (version, load_coefficients, recovery_hours, is_active, notes)
VALUES (
  'v1',
  '{"force":1.3,"sprint":1.1,"haies":1.1,"lancer":1.0,"saut":1.0,"endurance":0.9,"technique":0.7,"mobilite":0.4,"recuperation":0.3}'::jsonb,
  '{"sprint":72,"haies":72,"force":72,"saut":48,"lancer":48,"endurance":36,"technique":24,"mobilite":12,"recuperation":12}'::jsonb,
  true,
  'Version initiale — reprend telle quelle LOAD_COEFFICIENTS/RECOVERY_HOURS de trainingLoad.js (déjà en prod). Conventions de coaching AthleteOS, pas des valeurs publiées.'
);

-- 4) Chaque ligne session_athletes connaît désormais la version utilisée
--    pour calculer sa charge.
ALTER TABLE public.session_athletes
  ADD COLUMN model_version text REFERENCES public.charge_model_versions(version);

-- Backfill : toutes les lignes RPE déjà saisies ont été calculées avec les
-- coefficients qui sont exactement ceux de 'v1' (voir point 3) — ce n'est
-- donc pas un recalcul silencieux, juste nommer ce qui était déjà vrai.
UPDATE public.session_athletes SET model_version = 'v1' WHERE rpe IS NOT NULL AND model_version IS NULL;

-- 5) Timbre automatique : dès qu'un RPE est saisi ou modifié, la ligne est
--    associée à LA VERSION ACTIVE AU MOMENT DE LA SAISIE — pas recalculée
--    plus tard si la version active change. Trigger plutôt que code
--    applicatif : ne peut pas être oublié dans un futur écran d'écriture
--    (aujourd'hui déjà 2 chemins : AthleteApp.jsx et Planning.jsx).
CREATE OR REPLACE FUNCTION public.stamp_session_athlete_model_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.rpe IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.rpe IS DISTINCT FROM OLD.rpe) THEN
    SELECT version INTO NEW.model_version FROM public.charge_model_versions WHERE is_active LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER session_athletes_stamp_model_version
  BEFORE INSERT OR UPDATE ON public.session_athletes
  FOR EACH ROW EXECUTE FUNCTION public.stamp_session_athlete_model_version();

-- 6) weekly_charge recalcule maintenant CHAQUE LIGNE avec SA PROPRE version
--    (jointure sur session_athletes.model_version), plus jamais avec "la"
--    version actuelle codée en dur. C'est le changement central : une
--    nouvelle version active à l'avenir ne change plus l'historique.
--    COALESCE(...,1.0) préserve le comportement de secours de l'ancienne
--    vue (catégorie inconnue -> coefficient 1.0).
CREATE OR REPLACE VIEW public.weekly_charge
WITH (security_invoker = true)
AS
SELECT
  sa.athlete_id,
  s.week,
  SUM(
    ROUND(
      s.duration_minutes * sa.rpe *
      COALESCE((cmv.load_coefficients ->> s.category)::numeric, 1.0)
      / 10.0
    )
  )::integer AS raw_load
FROM public.session_athletes sa
JOIN public.sessions s ON s.id = sa.session_id
LEFT JOIN public.charge_model_versions cmv ON cmv.version = sa.model_version
WHERE sa.rpe IS NOT NULL
  AND s.duration_minutes IS NOT NULL
  AND s.week IS NOT NULL
GROUP BY sa.athlete_id, s.week;

GRANT SELECT ON public.weekly_charge TO authenticated;

COMMIT;
