BEGIN;

-- Les séquences (id SERIAL / BIGSERIAL) sont des objets Postgres séparés des
-- tables — le GRANT précédent sur les tables ne suffit pas pour permettre à
-- service_role d'insérer une ligne dont l'id est auto-généré.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

COMMIT;
