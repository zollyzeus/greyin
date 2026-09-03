-- ============================================================
-- Enterprise subscriptions: monetization via candidate-pool access
-- ============================================================
--
-- Phase 2 of the revamp plan. Replaces the originally-proposed
-- "Confirm Hire" tracked-invoice model (fee billed only after an
-- employer self-reports a hire) with payment collected up front: an
-- employer must hold an active subscription before /candidates (the
-- proactive Verified Expert search) will show them anything. This
-- closes the exploit the after-the-fact model had -- there's no
-- self-reported action to skip, since nothing is visible until
-- payment is confirmed.
--
-- Two tiers, per the user's direction:
--   starter    - self-serve, recurring, paid via Razorpay Subscriptions
--                (same gateway account FreeAgent already uses for
--                one-time Orders -- see 002_razorpay_integration.sql).
--   enterprise - sales-led. No card is ever collected in-app; an
--                employer submits a lead, gets invoiced off-platform,
--                and an admin flips their subscription active once
--                paid. Mirrors the plan's own reasoning for outplacement
--                deals ("enterprises want an invoice, not a checkout").
--
-- Scope: this only gates /candidates (proactive search). Posting jobs,
-- browsing jobs, and reviewing applicants to your own postings stay
-- free -- gating those would undercut the open-board liquidity the
-- Phase 1 hybrid gate decision (038) was built to preserve.
--
-- Security note: company_subscriptions has NO user-scoped UPDATE
-- policy, deliberately. Only an admin (manual enterprise activation)
-- or the service-role client (checkout verify + webhook, both gated
-- on a cryptographic Razorpay signature, not just row ownership) can
-- ever move a row out of 'pending'. A self-serve employer being able
-- to UPDATE their own row to 'active' directly would defeat the whole
-- point of gating on payment.
-- ============================================================

CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier TEXT NOT NULL UNIQUE CHECK (tier IN ('starter', 'enterprise')),
  name TEXT NOT NULL,
  price_inr INTEGER, -- rupees; NULL for enterprise (custom / contact sales)
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  razorpay_plan_id TEXT, -- lazily created + cached on first starter checkout
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.subscription_plans (tier, name, price_inr, billing_cycle, description) VALUES
  ('starter', 'Starter', 15000, 'monthly', 'Self-serve access to the Verified Expert candidate pool for one hiring team.'),
  ('enterprise', 'Enterprise', NULL, 'annual', 'Custom terms, multi-seat access, dedicated support -- contact sales.')
ON CONFLICT (tier) DO NOTHING;

GRANT SELECT ON public.subscription_plans TO anon, authenticated;

CREATE TABLE public.company_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  razorpay_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  activated_by UUID REFERENCES public.profiles(id),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies can view their own subscription"
  ON public.company_subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid()));

-- Only ever lets a company create the initial 'pending' placeholder --
-- see the security note above for why there's no matching UPDATE policy.
CREATE POLICY "Companies can create their own pending subscription"
  ON public.company_subscriptions FOR INSERT
  WITH CHECK (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can view all subscriptions"
  ON public.company_subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage all subscriptions"
  ON public.company_subscriptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Needed for the enterprise activation path: an admin activating a
-- company that never went through self-serve checkout has no existing
-- row to UPDATE, so this has to be a real INSERT, not just the policy
-- above.
CREATE POLICY "Admins can create subscriptions"
  ON public.company_subscriptions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE public.enterprise_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  team_size TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprise_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit their own enterprise lead"
  ON public.enterprise_leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view enterprise leads"
  ON public.enterprise_leads FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update enterprise leads"
  ON public.enterprise_leads FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Mirrors razorpay_webhooks (002_razorpay_integration.sql): inserts only
-- ever come from the webhook route's service-role client, which bypasses
-- RLS by design, so no INSERT policy is defined here.
CREATE TABLE public.subscription_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT,
  event_type TEXT NOT NULL,
  razorpay_subscription_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view subscription webhooks"
  ON public.subscription_webhooks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

NOTIFY pgrst, 'reload schema';
