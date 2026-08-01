BEGIN;

CREATE TABLE IF NOT EXISTS public.push_delivery_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_count integer NOT NULL CHECK (recipient_count BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_delivery_attempts_user_created_idx
  ON public.push_delivery_attempts (user_id, created_at DESC);

ALTER TABLE public.push_delivery_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_delivery_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.push_delivery_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.push_delivery_attempts_id_seq TO service_role;

COMMIT;
