-- ============================================================
-- Fix a real regression in 067's handle_email_confirmed() rewrite
-- ============================================================
--
-- 067 added the admin-role rejection fix (SEC-001) but reconstructed
-- the rest of the function from an incomplete read of 047's original
-- (only lines 80-129 were read, not the full body) -- dropped the
-- `role` column from the pillar_memberships INSERT entirely and
-- wrongly merged stackedge_role handling into the same CASE branch as
-- a fallback, when the original had it as a fully separate,
-- unconditional second INSERT. Caused every signup with a mapped
-- pillar to fail with "null value in column \"role\" of relation
-- \"pillar_memberships\" violates not-null constraint" -- caught
-- immediately by the post-067 regression run (admin-llm.spec.ts,
-- governance-voting.spec.ts) before this reached any real user.
--
-- This restores 047's exact original body byte-for-byte, with only the
-- one intentional 067 change (rejecting a self-declared 'admin' role)
-- preserved.
--
-- Run this after 068_fix_gig_order_payment_transition.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  meta JSONB := NEW.raw_user_meta_data;
  user_role TEXT := COALESCE(meta->>'role', 'candidate');
  full_name TEXT := trim(concat(meta->>'first_name', ' ', meta->>'last_name'));
  v_pillar TEXT;
  v_stackedge_role TEXT := meta->>'stackedge_role';
  v_years_experience INTEGER := NULLIF(meta->>'years_experience', '')::INTEGER;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 'admin' is a real value in profiles_role_check (038) for legitimate
  -- server-side/ops promotion, but must never be reachable through the
  -- public signup form -- force any attempt back to the safe default.
  -- (This is the one deliberate change from 047's original -- SEC-001.)
  IF user_role = 'admin' THEN
    user_role := 'candidate';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, years_experience, stackedge_role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(full_name, ''),
    user_role,
    v_years_experience,
    v_stackedge_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role = EXCLUDED.role,
    years_experience = COALESCE(EXCLUDED.years_experience, public.profiles.years_experience),
    stackedge_role = COALESCE(EXCLUDED.stackedge_role, public.profiles.stackedge_role),
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
    INSERT INTO public.candidates (user_id, experience_years)
    VALUES (NEW.id, v_years_experience)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  v_pillar := CASE
    WHEN user_role IN ('candidate', 'employer') THEN 'greyin'
    WHEN user_role IN ('client', 'freelancer') THEN 'freeagent'
    WHEN user_role = 'member' THEN 'saltnpepper'
    WHEN user_role IN ('author', 'follower') THEN 'greymatters'
  END;
  IF v_pillar IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, v_pillar, user_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  IF v_stackedge_role IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, 'stackedge', v_stackedge_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
