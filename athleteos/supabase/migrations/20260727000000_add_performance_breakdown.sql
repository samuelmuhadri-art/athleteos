BEGIN;

-- Détail par épreuve pour les disciplines combinées (Décathlon, Heptathlon) :
-- une performance "Décathlon" reste une ligne unique (discipline + total en
-- points), mais peut maintenant porter en plus le résultat de chaque épreuve
-- individuelle de cette compétition-là, sans créer 10 lignes séparées.
-- Colonne additive, nullable — aucun impact sur les performances existantes
-- ni sur les disciplines simples (breakdown reste NULL pour elles).
ALTER TABLE public.athlete_performances ADD COLUMN IF NOT EXISTS breakdown jsonb DEFAULT NULL;

COMMIT;
