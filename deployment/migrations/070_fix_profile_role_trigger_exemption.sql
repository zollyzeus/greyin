-- ============================================================
-- Fix profiles_role_immutable's trusted-caller exemption
-- ============================================================
--
-- 067's enforce_profile_role_immutable() only exempted auth.role() =
-- 'service_role', which reads a JWT claim that isn't necessarily set
-- for every legitimate trusted path -- specifically, handle_email_
-- confirmed() runs SECURITY DEFINER (owned by postgres), and Postgres
-- re-evaluates current_user (not the JWT claim) as the function owner
-- for the duration of its execution. That nested identity is what any
-- trigger it fires actually sees. Missing that exemption broke every
-- signup whose role differs from the placeholder profiles row's
-- default -- caught immediately by direct verification before
-- reaching prod-affecting e2e runs (the earlier "PASS" results were a
-- false negative: those specific test roles happened to match the
-- placeholder's default, so no real role change occurred to trip the
-- check).
--
-- Run this after 069_fix_handle_email_confirmed_regression.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_profile_role_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_user IN ('service_role', 'postgres', 'supabase_admin') OR auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only an admin can change a profile''s role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

NOTIFY pgrst, 'reload schema';
