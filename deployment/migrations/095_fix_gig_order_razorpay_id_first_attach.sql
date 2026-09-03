-- ============================================================
-- Fix enforce_gig_order_transition(): allow razorpay_order_id's
-- legitimate first-time attach; allow either party to dispute
-- ============================================================
--
-- Two real gaps in this trigger, found while wiring up 093's client-job
-- engagements (both apply to the pre-existing gig-purchase flow too,
-- not just the new path):
--
-- 1. razorpay_order_id blocked from EVER changing, including its own
--    NULL -> real-value transition -- but api/orders/create/route.ts's
--    own "preClaimedOrderId" path (its comment: "Mentor-session
--    bookings pre-claim their gig_orders row... this just attaches the
--    Razorpay order to that already-existing row") depends on exactly
--    that transition working, run as the buyer's own session (not
--    service_role, the trigger's only existing exemption). Found via
--    093's client-job-engagement e2e spec hitting this immediately
--    (mockRazorpayCheckout succeeding, then the DB update failing with
--    "razorpay_order_id can never change after creation") -- the same
--    call shape is used by the pre-existing mentor-session flow too,
--    so this was very likely already a live, if less-exercised, gap
--    there as well, not something newly introduced.
--
-- 2. The 'disputed' status transition only ever allowed
--    auth.uid() = OLD.buyer_id -- api/orders/dispute/route.ts's own
--    app-layer check was fixed to allow either party, but this DB
--    trigger enforces the real boundary underneath it and was never
--    updated to match, so a seller-raised dispute would still have
--    been rejected at the database level regardless of the route fix.
--
-- Everything else in this function is copied verbatim from 073's
-- definition (confirmed via pg_get_functiondef before writing this,
-- not from memory) -- only the two blocks below actually change.
--
-- Run this after 094_gate_gig_posting_on_subscription.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_gig_order_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_is_admin := EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');

  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION 'Order amount can never change after creation';
  END IF;

  -- CHANGED (was: blocked outright, same as amount above).
  IF NEW.razorpay_order_id IS DISTINCT FROM OLD.razorpay_order_id THEN
    IF OLD.razorpay_order_id IS NOT NULL THEN
      RAISE EXCEPTION 'razorpay_order_id can never change once set';
    END IF;
    IF auth.uid() IS DISTINCT FROM OLD.buyer_id THEN
      RAISE EXCEPTION 'Only the buyer can attach a payment order to their own order';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
      OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      RAISE EXCEPTION 'Attaching a payment order cannot also change status in the same statement';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.razorpay_payment_id IS DISTINCT FROM OLD.razorpay_payment_id
    OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
    OR NEW.refund_id IS DISTINCT FROM OLD.refund_id THEN

    IF OLD.payment_status IS NULL OR OLD.payment_status = 'pending' THEN
      -- Path 1: the buyer's own verify step capturing payment for the
      -- first time (065/068's original case).
      IF NEW.payment_status IS DISTINCT FROM 'captured' THEN
        RAISE EXCEPTION 'A direct client update may only move payment_status to captured';
      END IF;
      IF auth.uid() IS DISTINCT FROM OLD.buyer_id THEN
        RAISE EXCEPTION 'Only the buyer can confirm their own payment';
      END IF;
      IF NEW.status IS DISTINCT FROM 'paid' THEN
        RAISE EXCEPTION 'Capturing payment must set status to paid in the same update';
      END IF;

    ELSIF OLD.payment_status = 'captured' THEN
      -- Path 2/3: a refund, either the buyer cancelling before delivery
      -- or an admin resolving a dispute in the buyer's favor. Both look
      -- identical at the row level; only who's allowed to trigger it
      -- from which prior order status differs.
      IF NEW.payment_status IS DISTINCT FROM 'refunded' OR NEW.status IS DISTINCT FROM 'cancelled' THEN
        RAISE EXCEPTION 'Payment status can only be set once, or refunded together with cancellation';
      END IF;
      IF auth.uid() IS DISTINCT FROM OLD.buyer_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Only the buyer or an admin can refund this order';
      END IF;
      IF auth.uid() = OLD.buyer_id AND OLD.status NOT IN ('paid', 'authorized', 'in_progress') THEN
        RAISE EXCEPTION 'A buyer can only cancel before delivery';
      END IF;
      IF v_is_admin AND auth.uid() IS DISTINCT FROM OLD.buyer_id AND OLD.status IS DISTINCT FROM 'disputed' THEN
        RAISE EXCEPTION 'An admin can only resolve a genuinely disputed order';
      END IF;

    ELSE
      RAISE EXCEPTION 'Payment status can only be set once, or refunded from captured';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('in_progress', 'delivered') THEN
      IF auth.uid() IS DISTINCT FROM OLD.seller_id THEN
        RAISE EXCEPTION 'Only the seller can advance this order to %', NEW.status;
      END IF;
      IF OLD.payment_status IS DISTINCT FROM 'captured' THEN
        RAISE EXCEPTION 'Cannot progress an order that has not been paid';
      END IF;
    ELSIF NEW.status = 'completed' THEN
      IF v_is_admin AND auth.uid() IS DISTINCT FROM OLD.buyer_id THEN
        -- Admin releasing escrow to the freelancer after a dispute.
        IF OLD.status IS DISTINCT FROM 'disputed' THEN
          RAISE EXCEPTION 'An admin can only release escrow on a genuinely disputed order';
        END IF;
      ELSE
        IF auth.uid() IS DISTINCT FROM OLD.buyer_id THEN
          RAISE EXCEPTION 'Only the buyer can accept delivery';
        END IF;
        IF OLD.status IS DISTINCT FROM 'delivered' THEN
          RAISE EXCEPTION 'Can only complete a delivered order';
        END IF;
      END IF;
      IF OLD.payment_status IS DISTINCT FROM 'captured' THEN
        RAISE EXCEPTION 'Cannot complete an order that has not been paid';
      END IF;
    ELSIF NEW.status = 'revision_requested' THEN
      IF auth.uid() IS DISTINCT FROM OLD.buyer_id OR OLD.status IS DISTINCT FROM 'delivered' THEN
        RAISE EXCEPTION 'Invalid revision request';
      END IF;
    ELSIF NEW.status = 'disputed' THEN
      -- CHANGED (was: buyer-only, matching the now-fixed app-layer
      -- restriction in api/orders/dispute/route.ts). Either participant
      -- on the order can raise it.
      IF (auth.uid() IS DISTINCT FROM OLD.buyer_id AND auth.uid() IS DISTINCT FROM OLD.seller_id)
        OR OLD.status NOT IN ('delivered', 'revision_requested') THEN
        RAISE EXCEPTION 'Invalid dispute';
      END IF;
    ELSIF NEW.status = 'cancelled' THEN
      -- No captured payment on record -- nothing to refund, just cancel
      -- (the refund-bearing cancel path is handled above, since it also
      -- changes payment_status in the same update).
      IF (auth.uid() IS DISTINCT FROM OLD.buyer_id AND NOT v_is_admin) OR OLD.status NOT IN ('paid', 'authorized', 'in_progress', 'disputed') THEN
        RAISE EXCEPTION 'Invalid cancellation';
      END IF;
    ELSE
      RAISE EXCEPTION 'Status transition to % is not allowed directly', NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

NOTIFY pgrst, 'reload schema';
