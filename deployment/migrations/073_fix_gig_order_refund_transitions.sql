-- ============================================================
-- Extend the gig_orders payment trigger for real refund/dispute flows
-- ============================================================
--
-- 068's trigger only ever allowed ONE payment_status transition
-- (pending -> captured, by the buyer). Two more legitimate paths exist
-- in the real app, both running as the acting user's own session (not
-- service_role), and both got blocked outright once test/real data
-- actually had payment_status='captured' to begin with (caught by
-- escrow-workflow.spec.ts):
--   - apps/freeagent-marketplace/src/app/api/orders/cancel/route.ts --
--     a buyer cancelling before delivery gets a full refund:
--     payment_status captured -> refunded, status -> cancelled.
--   - apps/freeagent-marketplace/src/app/api/admin/orders/resolve-
--     dispute/route.ts -- an admin resolves a dispute either by
--     releasing escrow (status -> completed) or refunding the buyer
--     (payment_status captured -> refunded, status -> cancelled), from
--     a disputed order, and neither actor here is the order's own
--     buyer_id, so the existing per-status buyer-only checks also
--     needed an admin path added.
--
-- Run this after 072_fix_company_review_check.sql
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

  IF NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.razorpay_order_id IS DISTINCT FROM OLD.razorpay_order_id THEN
    RAISE EXCEPTION 'Order amount and razorpay_order_id can never change after creation';
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
      IF auth.uid() IS DISTINCT FROM OLD.buyer_id OR OLD.status NOT IN ('delivered', 'revision_requested') THEN
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
