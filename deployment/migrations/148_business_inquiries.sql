-- ============================================================
-- Business inquiries: a real, anonymous-friendly "Contact us"
-- ============================================================
--
-- Found by a UI/UX audit (2026-09-11): every one of the 7 apps' footers
-- has TWO separate links labeled "Feedback" and "Contact" -- but both
-- point at the exact same https://greyin.net/feedback?app=X URL. The
-- "Contact" label promises a sales/business channel; what it actually
-- opens is the login-gated product-feedback form (platform_feedback,
-- 101/052), which is the wrong destination for a prospective customer,
-- partner, or press inquiry who has no Greyin account and isn't
-- reporting a product issue.
--
-- DeepEdge already has a real B2B contact form (/enterprise-contact,
-- enterprise_leads, 039/044) but it requires login -- fine for an
-- existing DeepEdge customer requesting Enterprise/Fractional/
-- Outplacement service, wrong for an anonymous visitor. That form and
-- table are left untouched; this is a separate, simpler, genuinely
-- anonymous "Contact us" for general business inquiries from any of
-- the 7 apps, mirroring the anonymous-wishlist precedent (144) rather
-- than the login-gated feedback precedent.
-- ============================================================

CREATE TABLE public.business_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT,
  source_app TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a business inquiry"
  ON public.business_inquiries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view business inquiries"
  ON public.business_inquiries FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update business inquiries"
  ON public.business_inquiries FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX idx_business_inquiries_status ON public.business_inquiries(status, created_at DESC);

-- Same public-write rate-limit convention reused a fourth time this
-- week (demo_login/wishlist_anonymous/page_visit) -- 5/hour per IP,
-- matching the wishlist's tighter limit since spam sales inquiries are
-- just as admin-visible.
ALTER TABLE public.rate_limit_attempts DROP CONSTRAINT rate_limit_attempts_action_check;
ALTER TABLE public.rate_limit_attempts ADD CONSTRAINT rate_limit_attempts_action_check
  CHECK (action = ANY (ARRAY['password_reset', 'signup', 'demo_login', 'wishlist_anonymous', 'page_visit', 'business_inquiry']));

NOTIFY pgrst, 'reload schema';
