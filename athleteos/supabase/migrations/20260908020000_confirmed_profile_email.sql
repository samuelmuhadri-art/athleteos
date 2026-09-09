BEGIN;

-- Auth changes its email only after the configured confirmation flow succeeds.
CREATE OR REPLACE FUNCTION public.sync_confirmed_auth_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.users SET email = NEW.email WHERE auth_uid::text = NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_confirmed_auth_email() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER athleteos_confirmed_email_sync AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_confirmed_auth_email();

-- A direct profile update cannot bypass email ownership verification.
CREATE OR REPLACE FUNCTION public.guard_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.auth_uid IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM auth.users a WHERE a.id::text = NEW.auth_uid::text
        AND lower(a.email) = lower(NEW.email) AND a.email_confirmed_at IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Confirme la nouvelle adresse dans les paramètres du compte.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_email() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER athleteos_profile_email_guard BEFORE UPDATE OF email ON public.users
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_email();
COMMIT;
