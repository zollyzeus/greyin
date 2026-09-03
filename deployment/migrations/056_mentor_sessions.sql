-- ============================================================
-- Bookable mentor sessions (paid or unpaid), reusing FreeAgent's
-- existing gig/order/payout/Razorpay infrastructure
-- ============================================================
--
-- A mentor session is conceptually a gig with is_mentor_session = true;
-- mentor_session_slots is the new scheduling primitive on top of it --
-- discrete, pre-set, instantly bookable, not an availability-window/
-- request-approve model. Booking a slot creates a real gig_orders row,
-- so payout_requests/Razorpay/notifications all work unmodified.
--
-- Run this after 055_employment_history_salary_trends.sql
-- ============================================================

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS is_mentor_session BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_gigs_is_mentor_session ON public.gigs(is_mentor_session) WHERE is_mentor_session = true;

-- ------------------------------------------------------------
-- mentor_session_slots
-- ------------------------------------------------------------
CREATE TABLE public.mentor_session_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'booked', 'cancelled')),
  gig_order_id UUID REFERENCES public.gig_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_mentor_session_slots_gig_id ON public.mentor_session_slots(gig_id);
CREATE INDEX idx_mentor_session_slots_mentor_status ON public.mentor_session_slots(mentor_id, status);

ALTER TABLE public.mentor_session_slots ENABLE ROW LEVEL SECURITY;

-- Open slots are publicly bookable-browse; a mentor sees all their own
-- slots regardless of status; a buyer sees a slot once it's tied to
-- their own order (so a booked/past slot still renders on their
-- order-history page).
CREATE POLICY "Slots are viewable when open, or by the mentor, or by the booking buyer"
  ON public.mentor_session_slots FOR SELECT
  USING (
    status = 'open'
    OR mentor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.gig_orders go WHERE go.id = gig_order_id AND go.buyer_id = auth.uid())
  );

CREATE POLICY "Mentors can create slots for their own mentor-session gigs"
  ON public.mentor_session_slots FOR INSERT
  WITH CHECK (
    auth.uid() = mentor_id
    AND EXISTS (SELECT 1 FROM public.gigs WHERE id = gig_id AND freelancer_id = auth.uid() AND is_mentor_session = true)
  );

-- Mentors can edit/cancel their own still-open slots directly; the
-- open -> booked transition itself only ever happens inside
-- book_mentor_slot() below (SECURITY DEFINER), never via this policy,
-- since it must be atomic with creating the gig_orders row.
CREATE POLICY "Mentors can update their own open slots"
  ON public.mentor_session_slots FOR UPDATE
  USING (auth.uid() = mentor_id AND status = 'open');

CREATE POLICY "Mentors can delete their own open slots"
  ON public.mentor_session_slots FOR DELETE
  USING (auth.uid() = mentor_id AND status = 'open');

-- ------------------------------------------------------------
-- book_mentor_slot(): atomic claim-and-order, same reasoning as
-- get_or_create_conversation (021) -- a bare INSERT policy can't stop
-- two buyers racing for one slot; this locks the row, creates the
-- order, and marks the slot booked in one transaction.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_mentor_slot(p_slot_id UUID)
RETURNS UUID
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slot RECORD;
  v_gig RECORD;
  v_order_id UUID;
  v_amount INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_slot FROM public.mentor_session_slots WHERE id = p_slot_id FOR UPDATE;
  IF v_slot IS NULL OR v_slot.status <> 'open' THEN
    RAISE EXCEPTION 'slot_unavailable';
  END IF;
  IF v_slot.mentor_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_book_own_slot';
  END IF;

  SELECT * INTO v_gig FROM public.gigs WHERE id = v_slot.gig_id;
  v_amount := COALESCE(v_gig.price_min, 0);

  INSERT INTO public.gig_orders (gig_id, buyer_id, seller_id, amount, currency, status, payment_status, paid_at)
  VALUES (
    v_slot.gig_id, auth.uid(), v_slot.mentor_id, v_amount, COALESCE(v_gig.currency, 'INR'),
    CASE WHEN v_amount = 0 THEN 'paid' ELSE 'pending' END,
    CASE WHEN v_amount = 0 THEN 'captured' ELSE 'pending' END,
    CASE WHEN v_amount = 0 THEN now() ELSE NULL END
  )
  RETURNING id INTO v_order_id;

  UPDATE public.mentor_session_slots
  SET status = 'booked', gig_order_id = v_order_id
  WHERE id = p_slot_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.book_mentor_slot(UUID) TO authenticated;

-- ------------------------------------------------------------
-- finalize_completed_mentor_sessions(): lazy, page-load-triggered --
-- same pattern as finalize_expired_verified_outcomes (031), chosen for
-- the same reason: no pg_cron in this deployment.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_completed_mentor_sessions()
RETURNS void
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.gig_orders go
  SET status = 'completed', completed_at = now()
  FROM public.mentor_session_slots mss
  WHERE mss.gig_order_id = go.id
    AND mss.ends_at < now()
    AND go.status IN ('paid', 'in_progress');
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.finalize_completed_mentor_sessions() TO authenticated;

NOTIFY pgrst, 'reload schema';
