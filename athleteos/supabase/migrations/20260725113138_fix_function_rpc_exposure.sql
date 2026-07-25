BEGIN;

-- create_coach_alert : jamais appelée par l'app (les alertes sont insérées
-- directement via .from("alerts").insert(...) dans notifications.js), et
-- accepte p_club_id sans aucune vérification que l'appelant appartient à
-- ce club -> n'importe qui, même non connecté, pouvait forger une fausse
-- alerte dans n'importe quel club via /rest/v1/rpc/create_coach_alert.
REVOKE EXECUTE ON FUNCTION public.create_coach_alert(integer, integer, text, text, text, text) FROM anon, authenticated;
ALTER FUNCTION public.create_coach_alert(integer, integer, text, text, text, text) SET search_path TO 'public';

-- rls_auto_enable : fonction "event trigger" (RETURNS event_trigger),
-- invocable uniquement par le mécanisme de trigger lui-même, jamais par
-- un appel RPC direct. Aucune raison que anon/authenticated aient EXECUTE.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

COMMIT;
BEGIN;

REVOKE EXECUTE ON FUNCTION public.create_coach_alert(integer, integer, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;

COMMIT;
