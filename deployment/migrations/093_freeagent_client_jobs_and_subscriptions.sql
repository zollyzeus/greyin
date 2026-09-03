-- ============================================================
-- FreeAgent: client-posted jobs, subscription-gated posting,
-- per-transaction service fee (both sides), bidirectional disputes
-- ============================================================
--
-- User-directed revenue model change, replacing the "0%-commission"
-- claim entirely (that wording is being retired from PILLARS and
-- everywhere else it appears -- it was never actually true: posting a
-- gig was free but the seller was already charged 2% at payout, the
-- reverse of "freelancer pays nothing"). New model:
--   - A single subscription (one tier, gates BOTH posting a gig
--     listing as a freelancer AND posting a job as a client -- same
--     "one identity, multiple roles" pattern already used everywhere
--     else on this platform) is required to POST either kind of
--     listing. Applying to a job, or buying a gig, stays free --
--     the subscription gates supply (creating a listing), not demand.
--   - A modest service fee is charged to BOTH sides on an accepted
--     transaction (not charged at posting time -- charging at the
--     point of actual value, mirroring real marketplace precedent,
--     rather than a punitive flat posting fee that would suppress the
--     listing volume either side depends on).
--   - Either party (not just the buyer, as it was) can now flag an
--     order for admin review.
--
-- Design decision: client-accepted-job engagements reuse gig_orders
-- wholesale (escrow, Razorpay checkout, delivery/revision, dispute,
-- refund, admin resolution) rather than duplicating that entire
-- ~35-column proven flow into a parallel table. gig_id becomes
-- nullable with a new alternate origin (client_job_application_id);
-- every existing RLS policy on gig_orders already keys off
-- buyer_id/seller_id directly, never gig_id, so this needs zero RLS
-- changes there -- confirmed by reading every policy before writing
-- this migration, not assumed.
--
-- Run this after 092_application_withdrawal_and_job_close_reopen.sql
-- ============================================================

-- ------------------------------------------------------------
-- Subscription: one new tier, reusing 039's existing
-- subscription_plans/company_subscriptions design rather than
-- inventing a second billing system. freeagent_subscriptions mirrors
-- company_subscriptions exactly, keyed on a user instead of a company
-- (FreeAgent has no company concept -- individuals post directly).
-- ------------------------------------------------------------
ALTER TABLE public.subscription_plans DROP CONSTRAINT subscription_plans_tier_check;
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_tier_check
  CHECK (tier = ANY (ARRAY['starter', 'enterprise', 'freeagent_pro']));

INSERT INTO public.subscription_plans (tier, name, price_inr, billing_cycle, description) VALUES
  ('freeagent_pro', 'FlexPro Pro', 599, 'monthly', 'Post gig listings as a freelancer and job listings as a client. Applying to jobs and buying gigs stay free either way.')
ON CONFLICT (tier) DO NOTHING;

CREATE TABLE public.freeagent_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  razorpay_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  activated_by UUID REFERENCES public.profiles(id),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.freeagent_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.freeagent_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Same security posture as company_subscriptions (039): no user-scoped
-- UPDATE policy at all, deliberately. Only checkout/verify (service-
-- role, gated on a real Razorpay HMAC) or an admin can move a row out
-- of 'pending' -- a self-serve user flipping their own row to 'active'
-- directly would defeat the whole point of gating on payment.
CREATE POLICY "Users can create their own pending subscription"
  ON public.freeagent_subscriptions FOR INSERT
  WITH CHECK (status = 'pending' AND auth.uid() = user_id);

CREATE POLICY "Admins can view all freeagent subscriptions"
  ON public.freeagent_subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage all freeagent subscriptions"
  ON public.freeagent_subscriptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can create freeagent subscriptions"
  ON public.freeagent_subscriptions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER freeagent_subscriptions_updated_at
  BEFORE UPDATE ON public.freeagent_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- client_jobs: an expert posts a need instead of a gig listing --
-- the reverse direction FreeAgent never had. Posting requires an
-- active subscription (checked in the INSERT policy below); browsing
-- and applying stay free.
-- ------------------------------------------------------------
CREATE TABLE public.client_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_amount INTEGER,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_jobs_status ON public.client_jobs(status);
CREATE INDEX idx_client_jobs_client_id ON public.client_jobs(client_id);

ALTER TABLE public.client_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open jobs are public, own jobs visible regardless of status"
  ON public.client_jobs FOR SELECT
  USING (status = 'open' OR auth.uid() = client_id);

-- The actual subscription gate: posting requires an active
-- freeagent_subscriptions row. Applying to an existing job (below)
-- carries no such check -- only supply (posting) is gated.
CREATE POLICY "An active subscriber can post a client job"
  ON public.client_jobs FOR INSERT
  WITH CHECK (
    auth.uid() = client_id
    AND EXISTS (SELECT 1 FROM public.freeagent_subscriptions WHERE user_id = auth.uid() AND status = 'active')
  );

CREATE POLICY "Clients can update their own job"
  ON public.client_jobs FOR UPDATE
  USING (auth.uid() = client_id);

CREATE TRIGGER client_jobs_updated_at
  BEFORE UPDATE ON public.client_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- client_job_applications: a freelancer applies, free of charge.
-- Accepting one (client_id's own action) is what creates the real
-- transaction -- see the gig_orders extension below.
-- ------------------------------------------------------------
CREATE TABLE public.client_job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.client_jobs(id) ON DELETE CASCADE,
  freelancer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cover_note TEXT,
  proposed_price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, freelancer_id)
);

CREATE INDEX idx_client_job_applications_job_id ON public.client_job_applications(job_id);
CREATE INDEX idx_client_job_applications_freelancer_id ON public.client_job_applications(freelancer_id, status);

ALTER TABLE public.client_job_applications ENABLE ROW LEVEL SECURITY;

-- The job's own client sees every applicant; a freelancer sees only
-- their own application -- same "each side sees what's theirs" shape
-- as gig_orders' own buyer/seller SELECT split.
CREATE POLICY "Job client sees all applicants, freelancer sees their own"
  ON public.client_job_applications FOR SELECT
  USING (
    auth.uid() = freelancer_id
    OR EXISTS (SELECT 1 FROM public.client_jobs j WHERE j.id = job_id AND j.client_id = auth.uid())
  );

-- Free to apply -- no subscription check, matching the "supply is
-- gated, demand isn't" design. Only to a job that's actually still
-- open.
CREATE POLICY "Any authenticated user can apply to an open job"
  ON public.client_job_applications FOR INSERT
  WITH CHECK (
    auth.uid() = freelancer_id
    AND EXISTS (SELECT 1 FROM public.client_jobs j WHERE j.id = job_id AND j.status = 'open')
  );

-- A freelancer can withdraw their own still-pending application.
CREATE POLICY "Freelancers can withdraw their own pending application"
  ON public.client_job_applications FOR UPDATE
  USING (auth.uid() = freelancer_id AND status = 'pending')
  WITH CHECK (auth.uid() = freelancer_id AND status = 'withdrawn');

-- The job's client can accept or reject an application to their own
-- job. Acceptance itself (creating the real gig_orders row, closing
-- out competing applications) is orchestrated by the app route --
-- this policy just permits the status change on this one row; see
-- api/client-jobs/[id]/applications/[applicationId]/accept for the
-- rest of that transaction.
CREATE POLICY "Job client can accept or reject an application to their job"
  ON public.client_job_applications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.client_jobs j WHERE j.id = job_id AND j.client_id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.client_jobs j WHERE j.id = job_id AND j.client_id = auth.uid())
    AND status IN ('accepted', 'rejected')
  );

CREATE TRIGGER client_job_applications_updated_at
  BEFORE UPDATE ON public.client_job_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- gig_orders: nullable gig_id + a second possible origin, service-fee
-- columns for both sides, and dispute-raiser tracking so either party
-- (not just the buyer) can flag an order.
-- ------------------------------------------------------------
ALTER TABLE public.gig_orders ALTER COLUMN gig_id DROP NOT NULL;
ALTER TABLE public.gig_orders ADD COLUMN client_job_application_id UUID REFERENCES public.client_job_applications(id) ON DELETE SET NULL;
ALTER TABLE public.gig_orders ADD CONSTRAINT gig_orders_origin_check CHECK (
  (gig_id IS NOT NULL AND client_job_application_id IS NULL)
  OR (gig_id IS NULL AND client_job_application_id IS NOT NULL)
);

-- Computed and stored at the point the order is created, from
-- whichever origin -- audit trail of what was actually charged, not
-- just today's rate, in case the rate changes later.
ALTER TABLE public.gig_orders ADD COLUMN service_fee_buyer INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.gig_orders ADD COLUMN service_fee_seller INTEGER NOT NULL DEFAULT 0;

-- Who raised the dispute -- needed once the buyer-only restriction in
-- api/orders/dispute/route.ts is lifted, so admin resolution (and the
-- other party) can see who flagged it rather than just that someone did.
ALTER TABLE public.gig_orders ADD COLUMN disputed_by UUID REFERENCES public.profiles(id);

NOTIFY pgrst, 'reload schema';
