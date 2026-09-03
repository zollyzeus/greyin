-- ============================================================
-- Author tips (GreyMatters monetization) — from the "not recommended"
-- list, built anyway per explicit request
-- ============================================================
--
-- Collection only, same scope decision this session already made once for
-- FreeAgent before the RazorpayX integration existed: no payout rail here
-- either (a second one would be a lot of duplicated surface for a feature
-- explicitly flagged as low-priority) — an admin can see the ledger and
-- pay out manually, same as FreeAgent's original payout_requests did
-- before RazorpayX was wired in.
-- ============================================================

CREATE TABLE public.author_tips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipper_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tipper_email TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'paid', 'failed'])),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_author_tips_author_id ON public.author_tips(author_id);
CREATE INDEX idx_author_tips_post_id ON public.author_tips(post_id);

ALTER TABLE public.author_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can view tips they've received"
  ON public.author_tips FOR SELECT
  USING (auth.uid() = author_id);

-- Without this, PostgREST's implicit UPDATE...RETURNING (see migration
-- 016's note on the same gotcha) would reject a tipper marking their own
-- tip paid, since they have no other SELECT policy making the row visible.
CREATE POLICY "Tippers can view their own tips"
  ON public.author_tips FOR SELECT
  USING (auth.uid() = tipper_id);

CREATE POLICY "Anyone authenticated can create a tip"
  ON public.author_tips FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Tippers can update their own pending tip after payment verification"
  ON public.author_tips FOR UPDATE
  USING (auth.uid() = tipper_id);

NOTIFY pgrst, 'reload schema';
