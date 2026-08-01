BEGIN;

-- L'ajout de p_unit en 20260801020000 a créé une surcharge au lieu de
-- remplacer la signature historique. L'ancienne fonction, SECURITY DEFINER,
-- conservait alors le droit EXECUTE implicite de PUBLIC. Elle n'est plus
-- appelée par aucun RPC et ne doit jamais constituer une API cliente.
DROP FUNCTION IF EXISTS public._apply_competition_result(
  integer, integer, integer, text, text, text, numeric, boolean,
  text, text, boolean, date, jsonb
);

-- La seule signature restante est une aide interne appelée par les RPC
-- SECURITY DEFINER contrôlées. Son propriétaire postgres peut toujours
-- l'exécuter, mais aucun rôle Data API ne le peut directement.
REVOKE ALL ON FUNCTION public._apply_competition_result(
  integer, integer, integer, text, text, text, numeric, boolean,
  text, text, boolean, date, jsonb, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._apply_competition_result(
  integer, integer, integer, text, text, text, numeric, boolean,
  text, text, boolean, date, jsonb, text
) TO postgres;

COMMIT;
