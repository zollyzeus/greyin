-- ============================================================
-- Cross-pillar identity: membership tracking (additive)
-- ============================================================
--
-- The four apps already share one auth.users/profiles table, and the SSO
-- cookie-domain change (application code, not this migration) means a
-- session from one pillar now carries to the others automatically. What's
-- been missing is any record of *which* pillars a person is actually part
-- of, since profiles.role is a single overloaded value that every existing
-- RLS policy and feature gate in this codebase already depends on — this
-- table is deliberately additive (tracks membership + a per-pillar role
-- for display purposes) rather than replacing profiles.role, so nothing
-- already built has to change. Migrating every feature gate from
-- profiles.role to a pillar-scoped lookup is real future work, not
-- something to do quietly inside this migration.
-- ============================================================

CREATE TABLE public.pillar_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pillar TEXT NOT NULL CHECK (pillar = ANY (ARRAY['greyin', 'greymatters', 'saltnpepper', 'freeagent'])),
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pillar)
);

ALTER TABLE public.pillar_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pillar memberships"
  ON public.pillar_memberships FOR SELECT
  USING (auth.uid() = user_id);

-- Backfill from the role every existing user already signed up with, so
-- day-one users show up in the ecosystem widget immediately rather than
-- only new logins going forward.
INSERT INTO public.pillar_memberships (user_id, pillar, role)
SELECT id,
  CASE
    WHEN role IN ('candidate', 'employer') THEN 'greyin'
    WHEN role IN ('client', 'freelancer') THEN 'freeagent'
    WHEN role = 'member' THEN 'saltnpepper'
    WHEN role = 'author' THEN 'greymatters'
  END,
  role
FROM public.profiles
WHERE role IN ('candidate', 'employer', 'client', 'freelancer', 'member', 'author')
ON CONFLICT (user_id, pillar) DO NOTHING;

-- Called from each app's login route right after a successful sign-in.
-- SECURITY DEFINER isn't actually needed here (the RLS-safe version would
-- work fine since auth.uid() = user_id), but matches the pattern of the
-- other cross-cutting functions in this schema and avoids relying on the
-- caller's session having an INSERT policy that doesn't otherwise exist.
CREATE OR REPLACE FUNCTION public.ensure_pillar_membership(p_pillar TEXT, p_default_role TEXT)
RETURNS VOID
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO pillar_memberships (user_id, pillar, role)
  VALUES (auth.uid(), p_pillar, p_default_role)
  ON CONFLICT (user_id, pillar) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.ensure_pillar_membership(TEXT, TEXT) TO authenticated;

-- Also record it at the point profiles.role is actually set (signup
-- confirmation), so a user who only ever uses one pillar still gets a row
-- without needing the login-time RPC to have fired yet.
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  meta JSONB := NEW.raw_user_meta_data;
  user_role TEXT := COALESCE(meta->>'role', 'candidate');
  full_name TEXT := trim(concat(meta->>'first_name', ' ', meta->>'last_name'));
  v_pillar TEXT;
BEGIN
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

  v_pillar := CASE
    WHEN user_role IN ('candidate', 'employer') THEN 'greyin'
    WHEN user_role IN ('client', 'freelancer') THEN 'freeagent'
    WHEN user_role = 'member' THEN 'saltnpepper'
    WHEN user_role = 'author' THEN 'greymatters'
  END;
  IF v_pillar IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, v_pillar, user_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
