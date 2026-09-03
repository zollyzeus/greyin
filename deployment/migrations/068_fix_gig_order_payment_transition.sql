-- ============================================================
-- Fix a real functional bug in 067's gig_orders payment-field lock
-- ============================================================
--
-- 067's enforce_gig_order_transition() blocked ANY change to
-- payment_status/amount/razorpay_order_id/razorpay_payment_id/paid_at
-- outside a service_role session -- but apps/freeagent-marketplace's
-- primary payment-confirmation path (api/orders/verify/route.ts) is
-- synchronous, run as the BUYER's own authenticated session right
-- after Razorpay's checkout.js completes, not the async webhook. That
-- trigger would have hard-blocked every real payment. Caught before
-- reaching prod-affecting e2e runs by immediately re-checking migration
-- 067 against the actual route architecture.
--
-- The real invariant to enforce at this layer (SEC-004's DB-layer
-- half; the HMAC signature check itself can only happen app-side,
-- where the request payload is available) is narrower: a buyer may
-- capture payment on their own order exactly once, moving it from an
-- uncaptured state straight to 'paid'/'captured' together, and never
-- again afterward by anyone but service_role. Amount and
-- razorpay_order_id remain permanently locked post-creation for
-- everyone except service_role, same as 067 intended.
--
-- Run this after 067_security_critical_fixes.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_gig_order_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Trusted internal paths: a real PostgREST request authenticated with
  -- the service-role key (current_user becomes 'service_role' for that
  -- request, same as auth.role() reading the JWT claim), or a call
  -- nested inside another SECURITY DEFINER function owned by postgres
  -- (current_user becomes the function owner for its duration --
  -- auth.role() alone would miss this, since JWT claims aren't
  -- re-evaluated just because privilege context changed).
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Set once at creation, immutable to everyone but service_role
  -- afterward (a refund/dispute correction goes through admin routes,
  -- which use the service-role client).
  IF NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.razorpay_order_id IS DISTINCT FROM OLD.razorpay_order_id THEN
    RAISE EXCEPTION 'Order amount and razorpay_order_id can never change after creation';
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.razorpay_payment_id IS DISTINCT FROM OLD.razorpay_payment_id
    OR NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
    -- Gated on OLD.payment_status itself, not on whether the incoming
    -- value differs from it -- a replay attempt can present a *new*
    -- razorpay_payment_id while writing the *same* payment_status
    -- string ('captured'), which a "did this column's value change"
    -- check alone would miss entirely. Once genuinely captured (or
    -- refunded/failed), every one of these three fields is locked to
    -- everyone but service_role, full stop -- this is what actually
    -- stops a replayed (order_id, payment_id, signature) triple from
    -- landing on a row that already has a real payment recorded.
    IF OLD.payment_status = 'captured' THEN
      RAISE EXCEPTION 'Payment status can only be set once, by the buyer''s own verify step or the webhook';
    END IF;
    IF NEW.payment_status IS DISTINCT FROM 'captured' THEN
      RAISE EXCEPTION 'A direct client update may only move payment_status to captured';
    END IF;
    IF auth.uid() IS DISTINCT FROM OLD.buyer_id THEN
      RAISE EXCEPTION 'Only the buyer can confirm their own payment';
    END IF;
    IF NEW.status IS DISTINCT FROM 'paid' THEN
      RAISE EXCEPTION 'Capturing payment must set status to paid in the same update';
    END IF;
    -- This is the one legitimate self-service transition -- return
    -- early rather than falling into the status-transition checks
    -- below, which don't have a branch for 'paid' (nothing beyond it
    -- is reachable except through the seller/buyer transitions already
    -- covered there).
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
      IF auth.uid() IS DISTINCT FROM OLD.buyer_id THEN
        RAISE EXCEPTION 'Only the buyer can accept delivery';
      END IF;
      IF OLD.status IS DISTINCT FROM 'delivered' THEN
        RAISE EXCEPTION 'Can only complete a delivered order';
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
      IF auth.uid() IS DISTINCT FROM OLD.buyer_id OR OLD.status NOT IN ('paid', 'authorized', 'in_progress') THEN
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
