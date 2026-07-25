BEGIN;

-- Code d'invitation par club — permet à un nouvel athlète de s'inscrire
-- tout seul et d'être rattaché automatiquement au bon club, sans action
-- manuelle du coach. Colonne additive, nullable au départ.
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS invite_code text;
CREATE UNIQUE INDEX IF NOT EXISTS clubs_invite_code_idx ON public.clubs (invite_code) WHERE invite_code IS NOT NULL;

-- Backfill : les clubs existants (dont le tien) reçoivent un code tout de
-- suite, pour pouvoir inviter de nouveaux athlètes sans étape supplémentaire.
UPDATE public.clubs
SET invite_code = upper(substr(md5(random()::text || id::text), 1, 8))
WHERE invite_code IS NULL;

COMMIT;
