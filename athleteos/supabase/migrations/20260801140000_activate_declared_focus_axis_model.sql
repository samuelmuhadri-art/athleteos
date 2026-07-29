BEGIN;

-- La taxonomie d'objectifs déclarés introduite avec training_focus ne
-- modifie pas les six poids de base : elle choisit un profil plus précis
-- lorsque l'objectif est renseigné. On conserve donc v1 intacte pour
-- l'audit, et on crée une nouvelle version active avec les mêmes poids.
UPDATE public.axis_model_versions
SET is_active = false
WHERE is_active;

INSERT INTO public.axis_model_versions (
  version,
  axis_weights,
  is_active,
  notes
)
SELECT
  'v2-objectifs-declares',
  axis_weights,
  true,
  'Ajoute la sélection descriptive par objectif athlétique déclaré. Les poids de catégorie v1 restent inchangés et la charge session-RPE totale n est jamais modifiée.'
FROM public.axis_model_versions
WHERE version = 'v1'
ON CONFLICT (version) DO UPDATE SET
  axis_weights = EXCLUDED.axis_weights,
  is_active = true,
  notes = EXCLUDED.notes;

COMMIT;
