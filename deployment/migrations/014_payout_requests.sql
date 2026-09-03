-- ============================================================
-- Freelancer payout/withdrawal requests (FreeAgent)
-- ============================================================
--
-- No real bank-transfer integration exists (RazorpayX Payouts needs a
-- separate contract + KYC the platform hasn't set up), so this is a
-- request/ledger feature: freelancers see their available balance (sum of
-- completed order amounts, minus a platform fee, minus already-requested
-- amounts) and submit a withdrawal request with bank details. An admin
-- (profiles.role = 'admin', already a valid role per 001_initial_schema.sql)
-- marks requests as processed once the transfer is done manually/out-of-band.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  freelancer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  bank_account_name TEXT NOT NULL,
  bank_account_number TEXT NOT NULL,
  bank_ifsc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'processing', 'paid', 'rejected'])),
  admin_notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_freelancer_id ON public.payout_requests(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON public.payout_requests(status);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Freelancers can view their own payout requests"
  ON public.payout_requests FOR SELECT
  USING (auth.uid() = freelancer_id);

CREATE POLICY "Freelancers can create their own payout requests"
  ON public.payout_requests FOR INSERT
  WITH CHECK (auth.uid() = freelancer_id);

CREATE POLICY "Admins can view all payout requests"
  ON public.payout_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update payout requests"
  ON public.payout_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

NOTIFY pgrst, 'reload schema';
