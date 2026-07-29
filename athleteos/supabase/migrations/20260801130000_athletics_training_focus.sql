-- Objectif déclaré d'une séance : information descriptive séparée de la
-- charge session-RPE. Nullable pour préserver toutes les séances existantes.
alter table public.sessions
  add column if not exists training_focus text;

comment on column public.sessions.training_focus is
  'Objectif athlétique déclaré. N''applique aucun coefficient à la charge session-RPE.';
