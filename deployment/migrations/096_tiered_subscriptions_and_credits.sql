-- ============================================================
-- Generic multi-tier subscriptions + metered credits, shared by
-- FlexPro (gig/job posting) and DeepEdge (hiring/outplacement)
-- ============================================================
--
-- User-directed: 3 tiers each for FlexPro posting and DeepEdge hiring/
-- outplacement, admin-configurable price + "credits" per tier (how
-- many gigs/jobs/profile views/etc a subscriber gets per period).
-- Built as ONE reusable schema keyed by `product`, not two bespoke
-- systems -- both pillars need the exact same shape (named tiers,
-- named credit types, a per-user/per-period usage ledger), and a
-- shared admin UI can manage both from one component.
--
-- subscription_tiers replaces the single-plan assumption
-- freeagent_subscriptions/company_subscriptions had (089/039 each
-- only ever pointed at one row via a fixed `tier` string) -- tier_id
-- is added to both as a new, nullable, purely additive column, so
-- neither existing subscription lifecycle (Razorpay Subscriptions
-- checkout, activation, the /candidates starter/enterprise gate) is
-- touched. subscription_plans (039) is untouched too -- this is a
-- parallel, more general mechanism for the credit-bearing tiers
-- specifically, not a replacement.
--
-- consume_credit() is the one real enforcement point: SECURITY
-- DEFINER so it can read the caller's own tier and the shared
-- credit_usage ledger regardless of RLS, atomically check-and-
-- increment, and return whether the action is allowed. Callers never
-- write credit_usage directly.
--
-- Run this after 095_fix_gig_order_razorpay_id_first_attach.sql
-- ============================================================

CREATE TABLE public.subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT NOT NULL CHECK (product IN ('freeagent_posting', 'deepedge_hiring')),
  tier_key TEXT NOT NULL,
  name TEXT NOT NULL,
  price_inr INTEGER NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  razorpay_plan_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product, tier_key)
);

ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscription tiers are publicly readable"
  ON public.subscription_tiers FOR SELECT
  USING (true);

CREATE POLICY "Admins manage subscription tiers"
  ON public.subscription_tiers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- No shared updated_at trigger helper exists in this schema (checked --
-- every other table manages it inline or not at all), so this migration
-- defines its own, scoped to the one table that needs it.
CREATE OR REPLACE FUNCTION public.tiered_subscriptions_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER subscription_tiers_updated_at
  BEFORE UPDATE ON public.subscription_tiers
  FOR EACH ROW EXECUTE FUNCTION public.tiered_subscriptions_set_updated_at();

-- -1 = unlimited. One row per (tier, credit_type) -- credit_type is a
-- free-text label, not a fixed enum, so an admin can introduce a new
-- metered action later without a schema migration.
CREATE TABLE public.subscription_tier_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id UUID NOT NULL REFERENCES public.subscription_tiers(id) ON DELETE CASCADE,
  credit_type TEXT NOT NULL,
  monthly_allowance INTEGER NOT NULL,
  UNIQUE (tier_id, credit_type)
);

ALTER TABLE public.subscription_tier_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tier credit allowances are publicly readable"
  ON public.subscription_tier_credits FOR SELECT
  USING (true);

CREATE POLICY "Admins manage tier credit allowances"
  ON public.subscription_tier_credits FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Purely additive on both existing subscription tables -- neither
-- table's own lifecycle (status, Razorpay fields, activation) changes.
ALTER TABLE public.freeagent_subscriptions ADD COLUMN tier_id UUID REFERENCES public.subscription_tiers(id);
ALTER TABLE public.company_subscriptions ADD COLUMN tier_id UUID REFERENCES public.subscription_tiers(id);

-- One row per (user, product, credit_type, calendar month) -- the
-- period resets naturally by keying on period_start, no separate
-- rollover job needed.
CREATE TABLE public.credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  credit_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product, credit_type, period_start)
);

ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credit usage"
  ON public.credit_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all credit usage"
  ON public.credit_usage FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- No INSERT/UPDATE policy for regular users at all -- the only write
-- path is consume_credit() below, SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.get_active_tier_id(p_user_id UUID, p_product TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tier_id UUID;
BEGIN
  IF p_product = 'freeagent_posting' THEN
    SELECT tier_id INTO v_tier_id FROM freeagent_subscriptions WHERE user_id = p_user_id AND status = 'active';
  ELSIF p_product = 'deepedge_hiring' THEN
    SELECT cs.tier_id INTO v_tier_id
    FROM company_subscriptions cs
    JOIN companies c ON c.id = cs.company_id
    WHERE c.user_id = p_user_id AND cs.status = 'active';
  END IF;
  RETURN v_tier_id;
END;
$$;

-- Returns true (and records the usage) if the user's active tier has
-- remaining allowance for this credit_type this month; false (no
-- write) otherwise -- false covers both "no active tier" and "tier
-- has no allowance configured for this credit_type" the same way, so
-- callers don't need to distinguish.
CREATE OR REPLACE FUNCTION public.consume_credit(p_user_id UUID, p_product TEXT, p_credit_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_period DATE := date_trunc('month', now())::date;
  v_tier_id UUID;
  v_allowance INTEGER;
  v_used INTEGER;
BEGIN
  v_tier_id := get_active_tier_id(p_user_id, p_product);
  IF v_tier_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT monthly_allowance INTO v_allowance
  FROM subscription_tier_credits
  WHERE tier_id = v_tier_id AND credit_type = p_credit_type;

  IF v_allowance IS NULL THEN
    RETURN false;
  END IF;

  IF v_allowance <> -1 THEN
    SELECT used_count INTO v_used FROM credit_usage
    WHERE user_id = p_user_id AND product = p_product AND credit_type = p_credit_type AND period_start = v_period;
    IF COALESCE(v_used, 0) >= v_allowance THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO credit_usage (user_id, product, credit_type, period_start, used_count)
  VALUES (p_user_id, p_product, p_credit_type, v_period, 1)
  ON CONFLICT (user_id, product, credit_type, period_start)
  DO UPDATE SET used_count = credit_usage.used_count + 1, updated_at = now();

  RETURN true;
END;
$$;

-- Read-only helper for UI -- how many of a given credit_type remain
-- this period (NULL if the tier has no allowance configured for it,
-- -1 meaning unlimited).
CREATE OR REPLACE FUNCTION public.get_credit_remaining(p_user_id UUID, p_product TEXT, p_credit_type TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_period DATE := date_trunc('month', now())::date;
  v_tier_id UUID;
  v_allowance INTEGER;
  v_used INTEGER;
BEGIN
  v_tier_id := get_active_tier_id(p_user_id, p_product);
  IF v_tier_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT monthly_allowance INTO v_allowance FROM subscription_tier_credits WHERE tier_id = v_tier_id AND credit_type = p_credit_type;
  IF v_allowance IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_allowance = -1 THEN
    RETURN -1;
  END IF;
  SELECT used_count INTO v_used FROM credit_usage
  WHERE user_id = p_user_id AND product = p_product AND credit_type = p_credit_type AND period_start = v_period;
  RETURN v_allowance - COALESCE(v_used, 0);
END;
$$;

-- ------------------------------------------------------------
-- Seed: 3 tiers each, FlexPro posting and DeepEdge hiring
-- ------------------------------------------------------------
INSERT INTO public.subscription_tiers (product, tier_key, name, price_inr, sort_order) VALUES
  ('freeagent_posting', 'basic', 'Basic', 299, 1),
  ('freeagent_posting', 'pro', 'Pro', 599, 2),
  ('freeagent_posting', 'premium', 'Premium', 1299, 3),
  ('deepedge_hiring', 'basic', 'Basic', 9999, 1),
  ('deepedge_hiring', 'pro', 'Pro', 24999, 2),
  ('deepedge_hiring', 'premium', 'Premium', 49999, 3)
ON CONFLICT (product, tier_key) DO NOTHING;

-- FlexPro: one credit type today (gig_post covers both a gig listing
-- and a client job posting -- the two forms of "posting" 093 already
-- unified under one subscription gate). More types (e.g. a separate
-- allowance for job posts vs gig listings) are just another row away,
-- no migration needed.
INSERT INTO public.subscription_tier_credits (tier_id, credit_type, monthly_allowance)
SELECT id, 'gig_post', CASE tier_key WHEN 'basic' THEN 5 WHEN 'pro' THEN 20 WHEN 'premium' THEN -1 END
FROM public.subscription_tiers WHERE product = 'freeagent_posting'
ON CONFLICT (tier_id, credit_type) DO NOTHING;

-- DeepEdge: the credit types from the user's own list, cleaned into
-- distinct named types. job_post and profile_view are wired to real,
-- already-existing features this pass (job posting, candidate search)
-- -- see the app-layer changes. outplacement_post, placement_request,
-- contact_view, and job_invite are schema-ready (an admin can price
-- and allocate them right now) but not yet wired to a real consuming
-- action, since none of those are built as their own feature yet
-- (outplacement today is a lead-capture form, not a self-serve
-- posting flow) -- tracked explicitly, not silently implied as done.
INSERT INTO public.subscription_tier_credits (tier_id, credit_type, monthly_allowance)
SELECT id, credit_type, allowance
FROM public.subscription_tiers,
LATERAL (VALUES
  ('job_post', CASE tier_key WHEN 'basic' THEN 3 WHEN 'pro' THEN 10 WHEN 'premium' THEN -1 END),
  ('profile_view', CASE tier_key WHEN 'basic' THEN 50 WHEN 'pro' THEN 200 WHEN 'premium' THEN -1 END),
  ('contact_view', CASE tier_key WHEN 'basic' THEN 10 WHEN 'pro' THEN 50 WHEN 'premium' THEN -1 END),
  ('job_invite', CASE tier_key WHEN 'basic' THEN 10 WHEN 'pro' THEN 50 WHEN 'premium' THEN -1 END),
  ('outplacement_post', CASE tier_key WHEN 'basic' THEN 0 WHEN 'pro' THEN 5 WHEN 'premium' THEN -1 END),
  ('placement_request', CASE tier_key WHEN 'basic' THEN 0 WHEN 'pro' THEN 5 WHEN 'premium' THEN -1 END)
) AS credits(credit_type, allowance)
WHERE product = 'deepedge_hiring'
ON CONFLICT (tier_id, credit_type) DO NOTHING;

GRANT SELECT ON public.subscription_tiers TO anon, authenticated;
GRANT SELECT ON public.subscription_tier_credits TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
