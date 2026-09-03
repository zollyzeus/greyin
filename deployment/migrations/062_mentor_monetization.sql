-- ============================================================
-- Mentor monetization breadth: group/cohort slots, session
-- packages (bulk credits), and paid recording resale
-- ============================================================
--
-- Addresses the audit's highest-priority gap (Greyin Feature Benchmark
-- artifact / competitive audit, Aug 2026): mentor sessions were
-- discrete 1:1 booking + calendar + payment only, the single widest
-- feature gap found against Topmate (cohorts, digital products,
-- packages, paid DMs from one profile).
--
-- Deliberately additive, not a rewrite of 056's 1:1 flow: capacity=1
-- slots keep the exact existing book_mentor_slot() behavior
-- (mentor_session_slots.gig_order_id, one order per slot). capacity>1
-- (cohort) slots use the new mentor_session_bookings bridge table
-- instead, since one slot can now back multiple gig_orders.
--
-- Run this after 061_nl_search_feature_flag.sql
-- ============================================================

-- ------------------------------------------------------------
-- Cohort/group slots
-- ------------------------------------------------------------
ALTER TABLE public.mentor_session_slots
  ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  ADD COLUMN IF NOT EXISTS booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS recording_price INTEGER;

CREATE TABLE public.mentor_session_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id UUID NOT NULL REFERENCES public.mentor_session_slots(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gig_order_id UUID REFERENCES public.gig_orders(id) ON DELETE SET NULL,
  package_purchase_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id, buyer_id)
);

CREATE INDEX idx_mentor_session_bookings_slot ON public.mentor_session_bookings(slot_id);
CREATE INDEX idx_mentor_session_bookings_buyer ON public.mentor_session_bookings(buyer_id);

ALTER TABLE public.mentor_session_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers see their own bookings, mentors see bookings on their slots"
  ON public.mentor_session_bookings FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM public.mentor_session_slots s WHERE s.id = slot_id AND s.mentor_id = auth.uid())
  );

-- No direct INSERT/UPDATE policy -- every booking is created by the
-- SECURITY DEFINER functions below, atomically with the capacity check
-- and (for paid cohort slots) the gig_orders row, same reasoning as
-- book_mentor_slot() itself in 056.

-- ------------------------------------------------------------
-- book_cohort_slot(): capacity>1 counterpart to book_mentor_slot().
-- Locks the slot row to make the capacity check-and-increment atomic,
-- same race condition book_mentor_slot() already guards against.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_cohort_slot(p_slot_id UUID)
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
  IF v_slot.capacity <= 1 THEN
    RAISE EXCEPTION 'not_a_cohort_slot';
  END IF;
  IF v_slot.booked_count >= v_slot.capacity THEN
    RAISE EXCEPTION 'slot_full';
  END IF;
  IF v_slot.mentor_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_book_own_slot';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mentor_session_bookings WHERE slot_id = p_slot_id AND buyer_id = auth.uid()) THEN
    RAISE EXCEPTION 'already_booked';
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

  INSERT INTO public.mentor_session_bookings (slot_id, buyer_id, gig_order_id)
  VALUES (p_slot_id, auth.uid(), v_order_id);

  UPDATE public.mentor_session_slots
  SET booked_count = booked_count + 1,
      status = CASE WHEN booked_count + 1 >= capacity THEN 'booked' ELSE 'open' END
  WHERE id = p_slot_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.book_cohort_slot(UUID) TO authenticated;

-- ------------------------------------------------------------
-- Session packages: a mentor bundles N sessions at one price; buying
-- one grants redeemable credits instead of paying per booking.
-- ------------------------------------------------------------
CREATE TABLE public.mentor_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  session_count INTEGER NOT NULL CHECK (session_count >= 2),
  price INTEGER NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mentor_packages_gig ON public.mentor_packages(gig_id) WHERE active = true;

ALTER TABLE public.mentor_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active packages are publicly viewable, mentors see their own regardless"
  ON public.mentor_packages FOR SELECT
  USING (active = true OR mentor_id = auth.uid());

CREATE POLICY "Mentors can create packages for their own mentor-session gigs"
  ON public.mentor_packages FOR INSERT
  WITH CHECK (
    auth.uid() = mentor_id
    AND EXISTS (SELECT 1 FROM public.gigs WHERE id = gig_id AND freelancer_id = auth.uid() AND is_mentor_session = true)
  );

CREATE POLICY "Mentors can update their own packages"
  ON public.mentor_packages FOR UPDATE
  USING (auth.uid() = mentor_id)
  WITH CHECK (auth.uid() = mentor_id);

CREATE TABLE public.mentor_package_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID NOT NULL REFERENCES public.mentor_packages(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gig_order_id UUID REFERENCES public.gig_orders(id) ON DELETE SET NULL,
  sessions_remaining INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mentor_package_purchases_buyer ON public.mentor_package_purchases(buyer_id);

ALTER TABLE public.mentor_package_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers see their own purchases, mentors see purchases of their packages"
  ON public.mentor_package_purchases FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM public.mentor_packages p WHERE p.id = package_id AND p.mentor_id = auth.uid())
  );

-- ------------------------------------------------------------
-- purchase_mentor_package(): creates the gig_order (payment) and the
-- credit-granting purchase row atomically.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_mentor_package(p_package_id UUID)
RETURNS UUID
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_package RECORD;
  v_order_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_package FROM public.mentor_packages WHERE id = p_package_id AND active = true;
  IF v_package IS NULL THEN
    RAISE EXCEPTION 'package_unavailable';
  END IF;
  IF v_package.mentor_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_buy_own_package';
  END IF;

  INSERT INTO public.gig_orders (gig_id, buyer_id, seller_id, amount, currency, status, payment_status, paid_at)
  VALUES (
    v_package.gig_id, auth.uid(), v_package.mentor_id, v_package.price, v_package.currency,
    CASE WHEN v_package.price = 0 THEN 'paid' ELSE 'pending' END,
    CASE WHEN v_package.price = 0 THEN 'captured' ELSE 'pending' END,
    CASE WHEN v_package.price = 0 THEN now() ELSE NULL END
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.mentor_package_purchases (package_id, buyer_id, gig_order_id, sessions_remaining)
  VALUES (p_package_id, auth.uid(), v_order_id, v_package.session_count);

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.purchase_mentor_package(UUID) TO authenticated;

-- mentor_package_purchases didn't exist yet when mentor_session_bookings
-- was created above, so the FK is added here instead.
ALTER TABLE public.mentor_session_bookings
  ADD CONSTRAINT mentor_session_bookings_package_purchase_id_fkey
  FOREIGN KEY (package_purchase_id) REFERENCES public.mentor_package_purchases(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- book_slot_with_credit(): redeems one session credit from a package
-- purchase instead of paying again. Works for both 1:1 (capacity=1)
-- and cohort (capacity>1) slots, from the same mentor as the package.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_slot_with_credit(p_slot_id UUID, p_package_purchase_id UUID)
RETURNS UUID
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slot RECORD;
  v_purchase RECORD;
  v_package RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_slot FROM public.mentor_session_slots WHERE id = p_slot_id FOR UPDATE;
  IF v_slot IS NULL OR v_slot.status <> 'open' THEN
    RAISE EXCEPTION 'slot_unavailable';
  END IF;
  IF v_slot.booked_count >= v_slot.capacity THEN
    RAISE EXCEPTION 'slot_full';
  END IF;
  IF v_slot.mentor_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_book_own_slot';
  END IF;

  SELECT * INTO v_purchase FROM public.mentor_package_purchases WHERE id = p_package_purchase_id AND buyer_id = auth.uid() FOR UPDATE;
  IF v_purchase IS NULL OR v_purchase.sessions_remaining < 1 THEN
    RAISE EXCEPTION 'no_credits_remaining';
  END IF;

  SELECT * INTO v_package FROM public.mentor_packages WHERE id = v_purchase.package_id;
  IF v_package.mentor_id <> v_slot.mentor_id THEN
    RAISE EXCEPTION 'credit_wrong_mentor';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mentor_session_bookings WHERE slot_id = p_slot_id AND buyer_id = auth.uid()) THEN
    RAISE EXCEPTION 'already_booked';
  END IF;

  INSERT INTO public.mentor_session_bookings (slot_id, buyer_id, package_purchase_id)
  VALUES (p_slot_id, auth.uid(), p_package_purchase_id);

  UPDATE public.mentor_package_purchases SET sessions_remaining = sessions_remaining - 1 WHERE id = p_package_purchase_id;

  UPDATE public.mentor_session_slots
  SET booked_count = booked_count + 1,
      status = CASE WHEN booked_count + 1 >= capacity THEN 'booked' ELSE 'open' END
  WHERE id = p_slot_id;

  RETURN p_slot_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.book_slot_with_credit(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------
-- Recording resale: a mentor can price access to a slot's recording
-- separately from live attendance. Anyone (not just the attendee) can
-- purchase it.
-- ------------------------------------------------------------
CREATE TABLE public.mentor_recording_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id UUID NOT NULL REFERENCES public.mentor_session_slots(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gig_order_id UUID REFERENCES public.gig_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id, buyer_id)
);

ALTER TABLE public.mentor_recording_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers see their own recording purchases, mentors see purchases of their slots"
  ON public.mentor_recording_purchases FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM public.mentor_session_slots s WHERE s.id = slot_id AND s.mentor_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.purchase_recording_access(p_slot_id UUID)
RETURNS UUID
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slot RECORD;
  v_order_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_slot FROM public.mentor_session_slots WHERE id = p_slot_id;
  IF v_slot IS NULL OR v_slot.recording_url IS NULL OR v_slot.recording_price IS NULL THEN
    RAISE EXCEPTION 'recording_unavailable';
  END IF;
  IF v_slot.mentor_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_buy_own_recording';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mentor_recording_purchases WHERE slot_id = p_slot_id AND buyer_id = auth.uid()) THEN
    RAISE EXCEPTION 'already_purchased';
  END IF;

  INSERT INTO public.gig_orders (gig_id, buyer_id, seller_id, amount, currency, status, payment_status, paid_at)
  VALUES (
    v_slot.gig_id, auth.uid(), v_slot.mentor_id, v_slot.recording_price, 'INR',
    CASE WHEN v_slot.recording_price = 0 THEN 'paid' ELSE 'pending' END,
    CASE WHEN v_slot.recording_price = 0 THEN 'captured' ELSE 'pending' END,
    CASE WHEN v_slot.recording_price = 0 THEN now() ELSE NULL END
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.mentor_recording_purchases (slot_id, buyer_id, gig_order_id)
  VALUES (p_slot_id, auth.uid(), v_order_id);

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.purchase_recording_access(UUID) TO authenticated;

-- Mentors set/update the recording url+price on their own past slots
-- directly (no atomicity concern -- single-owner column update).
CREATE POLICY "Mentors can attach a recording to their own slots"
  ON public.mentor_session_slots FOR UPDATE
  USING (auth.uid() = mentor_id AND status IN ('open', 'booked'))
  WITH CHECK (auth.uid() = mentor_id);

NOTIFY pgrst, 'reload schema';
