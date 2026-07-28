BEGIN;

-- ============================================================
-- Tâche 14 — correctif : SECURITY DEFINER manquant
--
-- Trouvé en testant réellement contre la production (pas en relecture) :
-- les 5 fonctions de la migration 20260730010000 ont été créées SANS
-- `SECURITY DEFINER` — un oubli. Elles s'exécutaient donc avec les droits
-- du compte APPELANT (authenticated) au lieu de ceux du propriétaire, et
-- `authenticated` n'a jamais eu de droit direct sur `rpc_idempotency`/
-- `records`/`athlete_performances` etc. (ces tables ne sont censées être
-- touchées QUE via ces fonctions) → "permission denied for table
-- rpc_idempotency" au premier test réel.
--
-- Migration séparée plutôt que modifier 20260730010000 (déjà appliquée) —
-- ALTER FUNCTION suffit, pas besoin de réécrire le corps des fonctions.
-- ============================================================

ALTER FUNCTION public._apply_competition_result(
  integer, integer, integer, text, text, text, numeric, boolean, text, text, boolean, date, jsonb
) SECURITY DEFINER;

ALTER FUNCTION public.create_competition_with_athletes(text, date, text, text, jsonb, text) SECURITY DEFINER;
ALTER FUNCTION public.add_competition_result(integer, integer, text, text, numeric, boolean, text, text) SECURITY DEFINER;
ALTER FUNCTION public.create_solo_competition_result(text, date, text, text, text, text, numeric, boolean, text, text, jsonb) SECURITY DEFINER;
ALTER FUNCTION public.mark_notification_outbox_sent(bigint[]) SECURITY DEFINER;

COMMIT;
