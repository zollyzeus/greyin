-- ============================================================
-- SEC-033 (2026-08-26 security audit): payout_requests' INSERT policy
-- only checks auth.uid() = freelancer_id -- nothing at the DB level
-- constrains `amount` at all. The app's own route (api/payouts/
-- request/route.ts) already recomputes the real available balance
-- server-side and rejects an over-limit request, but a direct
-- PostgREST call (bypassing that route entirely) could still insert a
-- payout_requests row for any amount. Real-money exposure is limited
-- since an admin manually reviews and processes every request out-of-
-- band before any transfer happens (no live payout-rail integration
-- exists), but a fraudulent over-limit row is still a real gap an
-- inattentive admin approval could act on.
--
-- Fixed with a BEFORE INSERT trigger that recomputes the same formula
-- the app route already uses (2% platform fee off completed orders as
-- seller, minus already-requested non-rejected amounts) and rejects
-- anything over the real available balance -- defense in depth, same
-- number the UI already shows and the app route already enforces, now
-- also enforced regardless of which path the row came through.
--
-- Run this after 083_fix_skill_rating_dm_gate.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_payout_request_amount()
RETURNS TRIGGER AS $$
DECLARE
  v_total_earned INTEGER;
  v_net_earned INTEGER;
  v_already_claimed INTEGER;
  v_available INTEGER;
BEGIN
  -- Trusted server-side paths (admin tooling, future automation) stay
  -- exempt, same pattern as every other transition-guard trigger this
  -- audit added.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_earned
  FROM public.gig_orders
  WHERE seller_id = NEW.freelancer_id AND status = 'completed';

  v_net_earned := ROUND(v_total_earned * 0.98);

  SELECT COALESCE(SUM(amount), 0) INTO v_already_claimed
  FROM public.payout_requests
  WHERE freelancer_id = NEW.freelancer_id AND status != 'rejected';

  v_available := GREATEST(0, v_net_earned - v_already_claimed);

  IF NEW.amount > v_available THEN
    RAISE EXCEPTION 'Requested amount exceeds available balance';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_payout_request_amount ON public.payout_requests;
CREATE TRIGGER trg_enforce_payout_request_amount
  BEFORE INSERT ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payout_request_amount();

NOTIFY pgrst, 'reload schema';
