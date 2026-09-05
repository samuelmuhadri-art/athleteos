BEGIN;
-- Ne change ni les droits de lecture ni les policies ; rend les événements
-- disponibles au canal filtré (Supabase vérifie toujours la RLS pour chaque client).
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
COMMIT;
