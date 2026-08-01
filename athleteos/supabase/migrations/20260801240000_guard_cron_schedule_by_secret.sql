BEGIN;

-- Les migrations historiques créent les jobs avec l'URL du projet hébergé.
-- Sur une instance locale/CI sans secret Vault, ces jobs ne doivent jamais
-- tenter un appel distant. On les recrée uniquement lorsque le secret serveur
-- attendu existe réellement dans l'environnement cible.
SELECT cron.unschedule('weekly-notifications')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-notifications');
SELECT cron.unschedule('daily-session-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-session-reminders');

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'weekly_cron_service_role_key'
      AND nullif(btrim(decrypted_secret), '') IS NOT NULL
  ) THEN
    PERFORM cron.schedule(
      'weekly-notifications',
      '30 18 * * 0',
      $cron$
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
      $cron$
    );

    PERFORM cron.schedule(
      'daily-session-reminders',
      '30 5 * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://kuqafsmkwajeipzolbky.supabase.co/functions/v1/session-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'weekly_cron_service_role_key'
          )
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  ELSE
    RAISE NOTICE 'Crons distants non planifiés : secret Vault absent dans cet environnement.';
  END IF;
END;
$migration$;

COMMIT;
