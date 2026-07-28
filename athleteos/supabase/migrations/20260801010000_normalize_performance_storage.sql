BEGIN;

-- ============================================================
-- Tâche 12 — normaliser le stockage des performances
--
-- Problème : ni athlete_performances.value ni competition_results.result
-- n'ont de contrepartie numérique en base — seul du texte libre ("11.20",
-- "32m", "1:52.30"). Tout tri/comparaison/agrégation ne peut se faire
-- QUE côté client, en ré-analysant la chaîne à chaque lecture
-- (parsePerf(), tâche 11). records.pr_value/sb_value existent déjà
-- (tâche 14) mais seulement pour la comparaison "ce résultat bat-il le
-- record" côté serveur — jamais lus par l'UI, et un futur import
-- montre/FIT n'a ni valeur canonique fiable ni moyen de se dédupliquer.
--
-- Solution : ajoute une valeur numérique canonique + unité + identifiant
-- de discipline résolu + provenance sur athlete_performances et
-- competition_results (le texte brut existant, value/result, reste
-- inchangé — c'est déjà la "valeur brute pour l'affichage" demandée,
-- pas besoin d'une colonne raw_value redondante). Sur records, seulement
-- unit/discipline_id : pr_value/sb_value jouent déjà le rôle de valeur
-- canonique (une paire, pas une seule valeur) et c'est une table dérivée
-- (le meilleur résultat vu), pas une donnée importée en soi — source/
-- source_external_id/quality_flags n'ont pas de sens dessus.
--
-- Backfill via une fonction de parsing jetable (même approche et même
-- corps que _backfill_parse_perf de la tâche 14, recréée puis supprimée
-- ici) + une table de correspondance disciplines->unité construite à la
-- main à partir du registre JS (src/domain/disciplines.js, tâche 9) —
-- aucune table disciplines n'existe en base (décision déjà prise et
-- documentée tâche 9 : l'identifiant canonique EST le libellé, pas une
-- clé étrangère vers une table à part). Cette correspondance ne sert
-- qu'à CE backfill ponctuel ; les nouvelles écritures envoient déjà
-- l'unité/l'id résolus depuis le registre JS.
-- ============================================================

CREATE OR REPLACE FUNCTION public._backfill_parse_perf(p_str text)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  parts text[];
  v_leading text;
BEGIN
  IF p_str IS NULL OR btrim(p_str) = '' THEN RETURN NULL; END IF;
  IF btrim(p_str) ~ '^\d+:\d+' THEN
    parts := regexp_split_to_array(btrim(p_str), ':');
    RETURN parts[1]::numeric * 60 + parts[2]::numeric;
  END IF;
  BEGIN
    RETURN btrim(p_str)::numeric;
  EXCEPTION WHEN OTHERS THEN
    v_leading := substring(btrim(p_str) from '^-?\d+\.?\d*');
    IF v_leading IS NULL OR v_leading = '' OR v_leading = '-' THEN RETURN NULL; END IF;
    RETURN v_leading::numeric;
  END;
END;
$$;

-- Table de correspondance discipline -> (id canonique, unité, format
-- "minutes:secondes" attendu) — une ligne par identifiant officiel ET
-- par alias connu du registre JS, clé de recherche normalisée en
-- minuscules/espaces uniques (même logique que normalizeKey() côté JS).
CREATE TEMP TABLE _disc_lookup (
  search_key    text PRIMARY KEY,
  canonical_id  text NOT NULL,
  unit          text NOT NULL,
  is_time_long  boolean NOT NULL
);
INSERT INTO _disc_lookup (search_key, canonical_id, unit, is_time_long) VALUES
  ('100m','100m','s',false), ('100 m','100m','s',false), ('100 metres','100m','s',false), ('100m.','100m','s',false),
  ('200m','200m','s',false), ('200 m','200m','s',false),
  ('400m','400m','s',false), ('400 m','400m','s',false),
  ('800m','800m','s',true),  ('800 m','800m','s',true),
  ('1500m','1500m','s',true), ('1500 m','1500m','s',true), ('1 500m','1500m','s',true),
  ('3000m','3000m','s',true), ('3000 m','3000m','s',true), ('3 000m','3000m','s',true),
  ('60m haies','60m haies','s',false), ('60 m haies','60m haies','s',false), ('60m hurdles','60m haies','s',false),
  ('100m haies','100m haies','s',false), ('100 m haies','100m haies','s',false),
  ('110m haies','110m haies','s',false), ('110 m haies','110m haies','s',false),
  ('400m haies','400m haies','s',false), ('400 m haies','400m haies','s',false),
  ('longueur','Longueur','m',false), ('saut en longueur','Longueur','m',false),
  ('triple saut','Triple saut','m',false),
  ('hauteur','Hauteur','m',false), ('saut en hauteur','Hauteur','m',false),
  ('perche','Perche','m',false), ('saut à la perche','Perche','m',false),
  ('poids','Poids','m',false), ('lancer de poids','Poids','m',false),
  ('disque','Disque','m',false), ('lancer de disque','Disque','m',false),
  ('javelot','Javelot','m',false), ('lancer de javelot','Javelot','m',false),
  ('marteau','Marteau','m',false), ('lancer de marteau','Marteau','m',false),
  ('décathlon','Décathlon','pts',false), ('decathlon','Décathlon','pts',false),
  ('heptathlon','Heptathlon','pts',false);

-- ── athlete_performances ─────────────────────────────────────────────────
ALTER TABLE public.athlete_performances ADD COLUMN IF NOT EXISTS normalized_value numeric;
ALTER TABLE public.athlete_performances ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.athlete_performances ADD COLUMN IF NOT EXISTS discipline_id text;
ALTER TABLE public.athlete_performances ADD COLUMN IF NOT EXISTS source_external_id text;
ALTER TABLE public.athlete_performances ADD COLUMN IF NOT EXISTS quality_flags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.athlete_performances ADD CONSTRAINT athlete_performances_unit_check CHECK (unit IS NULL OR unit IN ('s','m','pts'));

UPDATE public.athlete_performances t SET
  discipline_id     = COALESCE(d.canonical_id, btrim(t.discipline)),
  unit               = d.unit,
  normalized_value   = public._backfill_parse_perf(t.value),
  quality_flags      = CASE
    WHEN public._backfill_parse_perf(t.value) IS NULL AND btrim(coalesce(t.value, '')) <> '' THEN ARRAY['unparsable']
    WHEN d.is_time_long AND t.value !~ ':' THEN ARRAY['format_ambiguous']
    ELSE '{}'::text[]
  END
FROM (
  SELECT ap.id, dl.canonical_id, dl.unit, dl.is_time_long
  FROM public.athlete_performances ap
  LEFT JOIN _disc_lookup dl ON dl.search_key = lower(btrim(regexp_replace(ap.discipline, '\s+', ' ', 'g')))
) d
WHERE d.id = t.id;

-- Empêche un même point importé deux fois par le même fournisseur (ex:
-- une activité Garmin ré-importée) — ne s'applique qu'aux lignes qui
-- déclarent une provenance externe, jamais aux saisies manuelles.
CREATE UNIQUE INDEX athlete_performances_source_external_id_key
  ON public.athlete_performances (source, source_external_id)
  WHERE source_external_id IS NOT NULL;

-- ── competition_results ──────────────────────────────────────────────────
ALTER TABLE public.competition_results ADD COLUMN IF NOT EXISTS result_value numeric;
ALTER TABLE public.competition_results ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.competition_results ADD COLUMN IF NOT EXISTS discipline_id text;
ALTER TABLE public.competition_results ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'club';
ALTER TABLE public.competition_results ADD COLUMN IF NOT EXISTS source_external_id text;
ALTER TABLE public.competition_results ADD COLUMN IF NOT EXISTS quality_flags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.competition_results ADD CONSTRAINT competition_results_unit_check CHECK (unit IS NULL OR unit IN ('s','m','pts'));

UPDATE public.competition_results t SET
  discipline_id  = COALESCE(d.canonical_id, btrim(t.event)),
  unit            = d.unit,
  result_value    = public._backfill_parse_perf(t.result),
  quality_flags   = CASE
    WHEN public._backfill_parse_perf(t.result) IS NULL AND btrim(coalesce(t.result, '')) <> '' THEN ARRAY['unparsable']
    WHEN d.is_time_long AND t.result !~ ':' THEN ARRAY['format_ambiguous']
    ELSE '{}'::text[]
  END
FROM (
  SELECT cr.id, dl.canonical_id, dl.unit, dl.is_time_long
  FROM public.competition_results cr
  LEFT JOIN _disc_lookup dl ON dl.search_key = lower(btrim(regexp_replace(coalesce(cr.event, ''), '\s+', ' ', 'g')))
) d
WHERE d.id = t.id;

-- ── records (déjà pr_value/sb_value depuis la tâche 14 — juste l'unité et
--    l'identifiant de discipline résolu manquent encore) ─────────────────
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS discipline_id text;
ALTER TABLE public.records ADD CONSTRAINT records_unit_check CHECK (unit IS NULL OR unit IN ('s','m','pts'));

UPDATE public.records t SET
  discipline_id = COALESCE(d.canonical_id, btrim(t.discipline)),
  unit           = d.unit
FROM (
  SELECT r.id, dl.canonical_id, dl.unit
  FROM public.records r
  LEFT JOIN _disc_lookup dl ON dl.search_key = lower(btrim(regexp_replace(coalesce(r.discipline, ''), '\s+', ' ', 'g')))
) d
WHERE d.id = t.id;

DROP TABLE _disc_lookup;
DROP FUNCTION public._backfill_parse_perf(text);

COMMIT;
