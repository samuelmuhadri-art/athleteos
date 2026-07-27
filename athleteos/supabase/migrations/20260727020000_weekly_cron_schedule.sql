BEGIN;

-- Cron serveur réel pour les notifs hebdo (récap + rapports) — avant ça,
-- checkWeeklyRecap()/checkWeeklyReports() (src/utils/notifications.js)
-- n'étaient déclenchés QUE quand quelqu'un ouvrait l'app dans la bonne
-- fenêtre horaire. Un dimanche soir sans personne connectée = rien
-- n'était envoyé. Ici, pg_cron appelle chaque semaine la fonction edge
-- weekly-cron, qui réimplémente la même logique côté serveur (mêmes
-- tables, même format de titre pour le dédoublonnage — les deux chemins
-- restent mutuellement idempotents).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- La clé d'authentification (secret key du nouveau système Supabase) est
-- stockée dans Vault, jamais en clair dans une migration versionnée —
-- voir vault.create_secret('...', 'weekly_cron_service_role_key', ...)
-- exécuté une fois manuellement (hors migration) lors de la mise en place.

SELECT cron.schedule(
  'weekly-notifications',
  '30 18 * * 0',  -- dimanche 18h30 UTC (~19h30-20h30 heure belge selon saison)
  $job$
  SELECT net.http_post(
    url := 'https://kuqafsmkwajeipzolbky.supabase.co/functions/v1/weekly-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'weekly_cron_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $job$
);

COMMIT;
