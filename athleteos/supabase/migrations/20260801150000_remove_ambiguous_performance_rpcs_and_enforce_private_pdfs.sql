BEGIN;

-- Les signatures enrichies ajoutées en 20260801020000 conservent p_unit
-- optionnel. Garder aussi les toutes premières signatures crée une
-- ambiguïté PostgREST quand un ancien client omet p_unit. On retire
-- uniquement ces deux surcharges obsolètes ; les signatures compatibles
-- avec paramètre optionnel et les RPC structurés v2 restent disponibles.
DROP FUNCTION IF EXISTS public.add_competition_result(
  integer, integer, text, text, numeric, boolean, text, text
);

DROP FUNCTION IF EXISTS public.create_solo_competition_result(
  text, date, text, text, text, text, numeric, boolean, text, text, jsonb
);

-- Réaffirme aussi les garanties du bucket sur les projets où il avait été
-- créé manuellement avant le suivi des migrations.
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 31457280,
  allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'session-pdfs';

COMMIT;
