-- ============================================================
-- Feature 2 of the Skillmeet.ai comparison round (2026-09-12):
-- "N recruiters viewed your profile" -- free aggregate count for every
-- candidate, "who viewed you" gated behind a new lightweight candidate
-- subscription product.
-- ============================================================
--
-- No per-viewer log of who looked at a candidate profile exists
-- anywhere today -- candidates/[id]/page.tsx's 'profile_view' credit
-- type (096) is only ever an aggregate monthly counter against the
-- VIEWING employer's own quota; it never recorded which candidate was
-- looked at. profile_views is the new table that makes this queryable
-- from the candidate's side.
--
-- candidate_subscriptions is a new, narrow, single-tier product
-- ('deepedge_candidate') mirroring company_subscriptions' shape
-- exactly (status/razorpay_subscription_id/current_period_end
-- lifecycle, no webhook -- same as company_subscriptions, which also
-- has none and instead relies on current_period_end lapsing after the
-- initial 1-month grant if never renewed, per candidates/page.tsx's
-- own expiry check). This is deliberately NOT wired into the existing
-- consume_credit()/credit_usage metering system -- "who viewed you" is
-- a binary unlock, not a countable/renewable resource, so a direct
-- status check (same shape as candidates/page.tsx's hasActiveSubscription)
-- is the right mechanism, not a new credit_type.
-- ============================================================

CREATE TABLE public.profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_views_viewed_user ON public.profile_views(viewed_user_id, created_at DESC);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- No direct SELECT/INSERT policy for anyone -- every read/write goes
-- through the SECURITY DEFINER functions below, so "who viewed me" can
-- be tier-gated server-side rather than merely hidden in the UI.

ALTER TABLE public.subscription_tiers DROP CONSTRAINT subscription_tiers_product_check;
ALTER TABLE public.subscription_tiers ADD CONSTRAINT subscription_tiers_product_check
  CHECK (product = ANY (ARRAY['flexpro_posting'::text, 'deepedge_hiring'::text, 'deepedge_candidate'::text]));

CREATE TABLE public.candidate_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES public.subscription_tiers(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  razorpay_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  activated_by UUID REFERENCES public.profiles(id),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidates view their own subscription"
  ON public.candidate_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Writes go through the service-role client from the checkout/verify
-- routes only, matching company_subscriptions' own trust model (039) --
-- no direct INSERT/UPDATE policy for authenticated users.

INSERT INTO public.subscription_tiers (product, tier_key, name, price_inr, sort_order)
VALUES ('deepedge_candidate', 'premium', 'Profile Insights', 199, 0);

-- Records a view iff the viewer is a different, real, authenticated
-- user -- SECURITY DEFINER so it can write regardless of the caller's
-- own RLS, same pattern as consume_credit(). Called right after any
-- successful candidate profile render (both the free own-applicant path
-- and the credit-metered path), since the point is "a real employer
-- looked at you," independent of whether it cost them a credit.
CREATE OR REPLACE FUNCTION public.record_profile_view(p_viewed_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = p_viewed_user_id THEN
    RETURN;
  END IF;
  INSERT INTO public.profile_views (viewer_id, viewed_user_id) VALUES (auth.uid(), p_viewed_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_profile_view(UUID) TO authenticated;

-- Returns the caller's own view count over the given window, plus the
-- viewer company/name list ONLY if the caller holds an active
-- candidate_subscriptions row -- otherwise viewer_names is NULL, so a
-- free-tier caller gets a count with no way to infer identity from the
-- array's mere presence/absence.
CREATE OR REPLACE FUNCTION public.get_profile_view_summary(p_since TIMESTAMPTZ DEFAULT now() - interval '7 days')
RETURNS TABLE (view_count BIGINT, viewer_names TEXT[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_has_premium BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.candidate_subscriptions cs
    WHERE cs.user_id = auth.uid()
      AND cs.status = 'active'
      AND (cs.current_period_end IS NULL OR cs.current_period_end > now())
  ) INTO v_has_premium;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profile_views pv WHERE pv.viewed_user_id = auth.uid() AND pv.created_at >= p_since),
    CASE WHEN v_has_premium THEN (
      SELECT ARRAY_AGG(COALESCE(co.name, p.full_name, 'An employer') ORDER BY pv.created_at DESC)
      FROM public.profile_views pv
      JOIN public.profiles p ON p.id = pv.viewer_id
      LEFT JOIN public.companies co ON co.user_id = pv.viewer_id
      WHERE pv.viewed_user_id = auth.uid() AND pv.created_at >= p_since
    ) ELSE NULL END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_view_summary(TIMESTAMPTZ) TO authenticated;
