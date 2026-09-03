-- ============================================================
-- Enterprise solutions: fractional leadership + outplacement lead capture
-- ============================================================
--
-- The original business plan named three enterprise offerings: age-blind
-- candidate search, fractional leadership placement, and corporate
-- outplacement. Only the first ever shipped as software (the Verified
-- Expert subscription, 039). The other two were explicitly sales-led,
-- high-touch B2B services in the plan's own language -- not something to
-- self-serve checkout, but also not something to leave undiscoverable.
-- Reuses the exact enterprise_leads pipeline built for the Enterprise
-- subscription tier (039) rather than standing up a separate mechanism --
-- same sales-led philosophy, one more dimension to triage by.
-- ============================================================

ALTER TABLE public.enterprise_leads
  ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'subscription'
    CHECK (service_type IN ('subscription', 'fractional_leadership', 'outplacement', 'general'));

NOTIFY pgrst, 'reload schema';
