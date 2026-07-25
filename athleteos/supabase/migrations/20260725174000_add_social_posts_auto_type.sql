BEGIN;

-- Colonne additive (nullable, défaut NULL) : permet de distinguer un post
-- manuel (photo/légende par un athlète) d'un post auto-généré par l'app
-- quand un athlète bat un record ou atteint un objectif — sans ça, le fil
-- du club reste vide tant que personne ne partage manuellement une photo.
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS auto_type text DEFAULT NULL;

COMMIT;
