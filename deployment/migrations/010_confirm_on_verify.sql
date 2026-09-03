-- ============================================================
-- Finalize account on email confirmation (works for OTP, link,
-- or admin-API confirmation alike)
-- ============================================================
--
-- Previously, each app's signup route upserted profiles/companies/
-- candidates immediately after auth.signUp(), before the account was
-- confirmed. Per product decision, an account (profile + role-specific
-- row) should only be finalized once the user's email is actually
-- verified — and if they never verify, calling signUp() again for the
-- same address should just resend a fresh code (GoTrue's default
-- behavior for unconfirmed users), no special handling needed.
--
-- This moves that finalization into a trigger on auth.users firing when
-- email_confirmed_at transitions from NULL to a real timestamp, driven
-- off raw_user_meta_data captured at signUp() time. That makes it
-- agnostic to *how* confirmation happened (OTP code entry, a clicked
-- link, or the Supabase Admin API used by the e2e suite to bypass email
-- for throwaway test accounts) — all of them set email_confirmed_at the
-- same way, so all of them finalize the account the same way.
--
-- Run this after 009_saltnpepper_community.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  meta JSONB := NEW.raw_user_meta_data;
  user_role TEXT := COALESCE(meta->>'role', 'candidate');
  full_name TEXT := trim(concat(meta->>'first_name', ' ', meta->>'last_name'));
BEGIN
  -- Only act on the NULL -> NOT NULL transition, so re-confirming (or any
  -- unrelated update to auth.users) never re-runs this.
  IF NEW.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, years_experience)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(full_name, ''),
    user_role,
    NULLIF(meta->>'years_experience', '')::INTEGER
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role = EXCLUDED.role,
    years_experience = COALESCE(EXCLUDED.years_experience, public.profiles.years_experience),
    updated_at = NOW();

  IF user_role = 'employer' THEN
    INSERT INTO public.companies (user_id, name, slug)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(full_name, ''), NEW.email) || '''s Company',
      'company-' || substr(NEW.id::text, 1, 8)
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF user_role = 'candidate' THEN
    INSERT INTO public.candidates (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL)
  EXECUTE FUNCTION public.handle_email_confirmed();

-- candidates.user_id and companies.user_id already carry UNIQUE(user_id)
-- from 001_initial_schema.sql, which is what the ON CONFLICT targets above
-- rely on.
