BEGIN;

-- ============================================================
-- Tâche 18 — versionner les poids du profil de charge à 6 axes
--
-- Même problème que les coefficients de charge (tâche 16, voir
-- charge_model_versions) : AXIS_WEIGHTS (poids catégorie -> axe) était
-- codé en dur dans src/utils/loadAxes.js, sans version ni audit. Contrairement
-- à LOAD_COEFFICIENTS, ces poids ne sont dupliqués nulle part en SQL (le
-- profil à 6 axes est 100% calculé côté client — voir le commentaire en
-- tête de loadAxes.js) : pas de risque de divergence JS/SQL à corriger ici,
-- mais le même besoin de gouvernance (versionné, borné, audité, "convention
-- AthleteOS" explicite) s'applique.
--
-- Portée volontairement limitée : cette migration crée la table
-- canonique et ses garde-fous, pas un écran de configuration par club —
-- tant qu'aucun écran coach n'existe pour créer une nouvelle version,
-- une seule version active = mode par défaut verrouillé pour le pilote.
-- ============================================================

CREATE TABLE public.axis_model_versions (
  version      text PRIMARY KEY,
  axis_weights jsonb NOT NULL,  -- { categorie: { axe: poids (0-1), ... }, ... }
  is_active    boolean NOT NULL DEFAULT false,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   text  -- users.id de l'auteur, une fois qu'un écran d'édition existera. NULL pour les versions créées hors app.
);

CREATE UNIQUE INDEX axis_model_versions_single_active
  ON public.axis_model_versions (is_active)
  WHERE is_active;

ALTER TABLE public.axis_model_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "axis_model_versions_read" ON public.axis_model_versions
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.axis_model_versions TO authenticated;
-- Pas de policy d'écriture pour authenticated — même raison que
-- charge_model_versions (migration 20260727040000) : pas d'écran coach
-- encore construit pour créer une version.

-- Bornes : chaque poids doit être un nombre entre 0 et 1 (0 = catégorie
-- n'affecte pas cet axe, 1 = affecte l'axe à pleine intensité relative).
CREATE OR REPLACE FUNCTION public.validate_axis_model_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cat      text;
  cat_val  jsonb;
  axis     text;
  axis_val jsonb;
  n        numeric;
BEGIN
  FOR cat, cat_val IN SELECT * FROM jsonb_each(NEW.axis_weights) LOOP
    IF jsonb_typeof(cat_val) <> 'object' THEN
      RAISE EXCEPTION 'axis_weights.% doit être un objet {axe: poids} (reçu: %)', cat, jsonb_typeof(cat_val);
    END IF;
    FOR axis, axis_val IN SELECT * FROM jsonb_each(cat_val) LOOP
      IF jsonb_typeof(axis_val) <> 'number' THEN
        RAISE EXCEPTION 'axis_weights.%.% doit être un nombre (reçu: %)', cat, axis, jsonb_typeof(axis_val);
      END IF;
      n := (axis_val#>>'{}')::numeric;
      IF n < 0 OR n > 1 THEN
        RAISE EXCEPTION 'axis_weights.%.% doit être entre 0 et 1 (reçu: %)', cat, axis, n;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER axis_model_versions_validate
  BEFORE INSERT OR UPDATE ON public.axis_model_versions
  FOR EACH ROW EXECUTE FUNCTION public.validate_axis_model_version();

-- Version initiale — valeurs IDENTIQUES à AXIS_WEIGHTS dans loadAxes.js
-- (déjà en prod). Aucun score existant ne change de valeur.
INSERT INTO public.axis_model_versions (version, axis_weights, is_active, notes)
VALUES (
  'v1',
  '{
    "sprint":       {"neuromuscular":1.0, "elastic":0.7, "metabolic":0.3, "muscular":0.3, "technical":0.5, "mental":0.4},
    "haies":        {"neuromuscular":0.9, "elastic":0.8, "metabolic":0.3, "muscular":0.3, "technical":0.8, "mental":0.5},
    "force":        {"neuromuscular":0.6, "elastic":0.3, "metabolic":0.3, "muscular":1.0, "technical":0.3, "mental":0.3},
    "saut":         {"neuromuscular":0.8, "elastic":1.0, "metabolic":0.3, "muscular":0.4, "technical":0.8, "mental":0.5},
    "lancer":       {"neuromuscular":0.7, "elastic":0.5, "metabolic":0.2, "muscular":0.7, "technical":0.9, "mental":0.4},
    "endurance":    {"neuromuscular":0.2, "elastic":0.2, "metabolic":1.0, "muscular":0.3, "technical":0.2, "mental":0.3},
    "technique":    {"neuromuscular":0.3, "elastic":0.3, "metabolic":0.2, "muscular":0.2, "technical":1.0, "mental":0.3},
    "mobilite":     {"neuromuscular":0.1, "elastic":0.2, "metabolic":0.1, "muscular":0.1, "technical":0.2, "mental":0.2},
    "recuperation": {"neuromuscular":0.05,"elastic":0.05,"metabolic":0.1, "muscular":0.05,"technical":0.05,"mental":0.1}
  }'::jsonb,
  true,
  'Version initiale — reprend telle quelle AXIS_WEIGHTS de loadAxes.js (déjà en prod). Convention de coaching AthleteOS, pas des valeurs publiées.'
);

COMMIT;
