-- ============================================================
-- Profile Role Fixes + Experience Field
-- ============================================================
--
-- The original profiles.role CHECK constraint only allowed
-- ('candidate','client','freelancer','admin','author'), but the
-- Greyin B2B app (and the copy-pasted signup flow on every other
-- app) actually needs 'employer' for companies, and Salt & Pepper
-- needs 'member'. Every signup that picked "employer" was silently
-- failing the CHECK constraint and falling back to the DB trigger's
-- default profile row. This widens the constraint to match what the
-- apps actually use, and adds years_experience (used to gate Salt &
-- Pepper signups at 12+ years per the business plan).
--
-- Run this after 006_order_reviews.sql
-- ============================================================

DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('candidate', 'client', 'freelancer', 'admin', 'author', 'employer', 'member'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS years_experience INTEGER;

COMMENT ON COLUMN public.profiles.years_experience IS 'Self-reported years of professional experience; used to gate Salt & Pepper signup at 12+ years';
