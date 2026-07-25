BEGIN;

-- service_role (utilisé par TOUTES les Edge Functions via SUPABASE_SERVICE_ROLE_KEY)
-- n'avait de droits CRUD complets que sur 2 des 22 tables (athlete_wellness,
-- push_subscriptions — celles dont les policies RLS ont été réécrites cette
-- session). Sur les 20 autres, service_role n'avait que REFERENCES/TRIGGER/
-- TRUNCATE, sans SELECT/INSERT/UPDATE/DELETE — un GRANT manquant, indépendant
-- des policies RLS. Resté invisible jusqu'ici car aucune fonction serveur
-- n'avait encore besoin d'écrire dans clubs/users/athletes (la nouvelle
-- fonction "signup" est la première).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Pour que les tables créées à l'avenir héritent automatiquement des mêmes
-- droits, sans devoir y repenser à chaque nouvelle table.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

COMMIT;
