-- ============================================================
-- Real payout-rail columns (RazorpayX Payouts, with fallback)
-- ============================================================
--
-- No RazorpayX credentials exist yet (needs a separate contract + KYC step
-- that's a business/compliance process, not something this migration can
-- solve) — but the integration code should be real and ready to activate
-- the moment those credentials exist, falling back to today's manual
-- admin-marks-paid flow when they don't. These columns record which path a
-- given payout actually took.
-- ============================================================

ALTER TABLE public.payout_requests
  ADD COLUMN payout_method TEXT NOT NULL DEFAULT 'manual' CHECK (payout_method = ANY (ARRAY['manual', 'razorpayx'])),
  ADD COLUMN razorpayx_payout_id TEXT,
  ADD COLUMN razorpayx_fund_account_id TEXT,
  ADD COLUMN failure_reason TEXT;

NOTIFY pgrst, 'reload schema';
