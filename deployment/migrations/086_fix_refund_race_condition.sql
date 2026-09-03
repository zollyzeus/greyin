-- ============================================================
-- SEC-035 (2026-08-26 security audit): api/orders/cancel/route.ts and
-- api/admin/orders/resolve-dispute/route.ts both SELECT the order,
-- check its status, call Razorpay's refund API, then UPDATE the row --
-- with no row lock between the check and the external call. Two
-- concurrent requests for the same order (a double-click, a replayed
-- request) could both pass the status check before either UPDATE
-- lands, both call refundPayment(), and issue two real refunds.
-- refundPayment()'s third argument only goes into Razorpay's `notes`
-- field (plain metadata), not the real X-Razorpay-Idempotency-Key
-- mechanism, so Razorpay itself doesn't dedupe this either.
--
-- Fixed with a claim-then-act pattern, same shape as this codebase's
-- existing atomic-claim RPCs (book_mentor_slot, get_or_create_
-- conversation): a SECURITY DEFINER function does SELECT ... FOR
-- UPDATE (a real row lock) plus the same authorization/status checks
-- the app route already did, and atomically marks refund_status =
-- 'pending' as a claim marker before returning success -- a second
-- concurrent caller's FOR UPDATE blocks until the first transaction
-- commits, then sees refund_status already 'pending' and is refused
-- the claim, so it never calls Razorpay a second time. refund_status
-- was already a real column (014/020) used only as an end-state
-- marker, never read/gated anywhere else, so repurposing its 'pending'
-- value as the claim marker doesn't collide with anything.
--
-- Run this after 085_harden_security_definer_search_path.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_order_cancellation_refund(p_order_id UUID)
RETURNS TABLE(claimed BOOLEAN, amount INTEGER, razorpay_payment_id TEXT)
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, NULL::INTEGER, NULL::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_order FROM gig_orders WHERE id = p_order_id FOR UPDATE;

  IF v_order IS NULL
    OR v_order.buyer_id IS DISTINCT FROM auth.uid()
    OR v_order.status NOT IN ('paid', 'in_progress')
    OR v_order.refund_status IN ('pending', 'processed')
  THEN
    RETURN QUERY SELECT false, NULL::INTEGER, NULL::TEXT;
    RETURN;
  END IF;

  UPDATE gig_orders SET refund_status = 'pending' WHERE id = p_order_id;
  RETURN QUERY SELECT true, v_order.amount, v_order.razorpay_payment_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.claim_order_cancellation_refund(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_order_dispute_refund(p_order_id UUID)
RETURNS TABLE(claimed BOOLEAN, amount INTEGER, razorpay_payment_id TEXT)
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN QUERY SELECT false, NULL::INTEGER, NULL::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_order FROM gig_orders WHERE id = p_order_id FOR UPDATE;

  IF v_order IS NULL
    OR v_order.status != 'disputed'
    OR v_order.refund_status IN ('pending', 'processed')
  THEN
    RETURN QUERY SELECT false, NULL::INTEGER, NULL::TEXT;
    RETURN;
  END IF;

  UPDATE gig_orders SET refund_status = 'pending' WHERE id = p_order_id;
  RETURN QUERY SELECT true, v_order.amount, v_order.razorpay_payment_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.claim_order_dispute_refund(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
