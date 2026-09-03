-- ============================================================
-- CRITICAL security fixes -- pre-launch audit, 2026-08-24
-- ============================================================
--
-- Tracked in docs/greyin-requirements-traceability.xlsx, "Security
-- Findings" sheet. This migration closes the database-layer half of
-- SEC-001/002 (admin self-escalation), SEC-005/006 (gig_orders payment
-- integrity), SEC-006/007 (unauthenticated financial/reputation RPCs),
-- SEC-008 (verified_outcomes self-verification), SEC-013 (collaborators
-- RLS bypass), and SEC-020 (company_reviews reviewer de-anonymization).
-- App-layer halves (signup role allowlist, order amount/verify binding,
-- storage bucket, XSS, committed secret) are separate, non-SQL fixes.
--
-- Run this after 066_reference_verified_pillar.sql
-- ============================================================

-- ------------------------------------------------------------
-- SEC-002: profiles.role can currently be self-escalated via a direct
-- PATCH -- the UPDATE policy (001) is row-scoped only, no column
-- protection. service_role (trusted ops/e2e promotion) is exempted;
-- everyone else may only change role if they are already an admin.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_role_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Only an admin can change a profile''s role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS profiles_role_immutable ON public.profiles;
CREATE TRIGGER profiles_role_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_role_immutable();

-- ------------------------------------------------------------
-- SEC-001 (database half): handle_email_confirmed() currently trusts
-- raw_user_meta_data.role verbatim, including 'admin', at signup. The
-- app-side signup routes get their own allowlist fix too, but per the
-- audit's own finding this trigger is the real gate -- the browser can
-- call auth.signUp() directly with the public anon key, bypassing any
-- app-layer check entirely.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  meta JSONB := NEW.raw_user_meta_data;
  user_role TEXT := COALESCE(meta->>'role', 'candidate');
  full_name TEXT := trim(concat(meta->>'first_name', ' ', meta->>'last_name'));
  v_pillar TEXT;
  v_stackedge_role TEXT := meta->>'stackedge_role';
  v_years_experience INTEGER := NULLIF(meta->>'years_experience', '')::INTEGER;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 'admin' is a real value in profiles_role_check (038) for legitimate
  -- server-side/ops promotion, but must never be reachable through the
  -- public signup form -- force any attempt back to the safe default.
  IF user_role = 'admin' THEN
    user_role := 'candidate';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, years_experience, stackedge_role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(full_name, ''),
    user_role,
    v_years_experience,
    v_stackedge_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role = EXCLUDED.role,
    years_experience = COALESCE(EXCLUDED.years_experience, public.profiles.years_experience),
    stackedge_role = COALESCE(EXCLUDED.stackedge_role, public.profiles.stackedge_role),
    updated_at = NOW();

  IF user_role = 'employer' THEN
    INSERT INTO public.companies (user_id, name, slug)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(full_name, ''), NEW.email) || '''s Company',
      'company-' || substr(NEW.id::text, 1, 8)
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF user_role = 'candidate' THEN
    INSERT INTO public.candidates (user_id, experience_years)
    VALUES (NEW.id, v_years_experience)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  v_pillar := CASE
    WHEN user_role IN ('employer', 'candidate') THEN 'greyin'
    WHEN user_role IN ('client', 'freelancer') THEN 'freeagent'
    WHEN user_role = 'member' THEN 'saltnpepper'
    WHEN user_role IN ('supporter', 'follower') OR v_stackedge_role IS NOT NULL THEN 'stackedge'
    WHEN user_role = 'author' THEN 'greymatters'
    ELSE NULL
  END;

  IF v_pillar IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar)
    VALUES (NEW.id, v_pillar)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- SEC-006 / SEC-007: capture_razorpay_payment, process_razorpay_refund,
-- create_razorpay_order, and award_reputation are all SECURITY DEFINER
-- with no explicit GRANT statement anywhere in the tree -- Postgres
-- defaults new function EXECUTE to PUBLIC, so anon/authenticated can
-- call every one of these directly via PostgREST's /rpc/ endpoint.
-- Confirmed via grep: none of the four is actually called from any app
-- route or client code (payment status changes go through direct table
-- updates in the webhook/order routes instead; award_reputation is only
-- ever invoked internally via PERFORM from other trigger functions in
-- 025). Revoking PUBLIC execute closes the hole with zero functional
-- change -- the functions remain callable from other SECURITY DEFINER
-- definer-owned code paths regardless of this revoke.
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.capture_razorpay_payment(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_razorpay_refund(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_razorpay_order(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_reputation(UUID, TEXT, INTEGER, UUID) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- SEC-008: verified_outcomes' subject-submits-own-outcome INSERT policy
-- (031) has no WITH CHECK on status, so a self-submission can set
-- status='verified' directly, completely bypassing the intended
-- "counterparty reviews, or 14-day auto-expiry" flow. Force every
-- self-submission to start pending; 'verified' is only reachable via
-- the existing counterparty UPDATE policy or finalize_expired_
-- verified_outcomes().
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Subjects can submit their own outcome for verification" ON public.verified_outcomes;
CREATE POLICY "Subjects can submit their own outcome for verification"
  ON public.verified_outcomes FOR INSERT
  WITH CHECK (auth.uid() = subject_user_id AND status = 'pending');

-- ------------------------------------------------------------
-- SEC-013: collaborators' own comment claims "security comes from the
-- underlying tables' RLS still applying to the querying role" -- false
-- without security_invoker, since a plain view runs as its owner by
-- default (PG15+ feature, confirmed available: this instance runs 15.1).
-- Without this, any authenticated user can read every StackEdge
-- collaboration and FreeAgent order pairing on the platform, not just
-- pairs they're part of.
-- ------------------------------------------------------------
ALTER VIEW public.collaborators SET (security_invoker = true);

-- ------------------------------------------------------------
-- SEC-005 / SEC-006 (gig_orders half): three overlapping permissive
-- UPDATE policies (003, 004) let either buyer or seller directly PATCH
-- any column, including status and the payment fields the 003 comment
-- claims are "protected by SECURITY DEFINER functions" -- they never
-- were. This trigger is the actual enforcement: payment-authority
-- columns are locked to the service_role path (the Razorpay webhook
-- handler already writes via the service-role client), and status can
-- only move through the specific transitions the intended workflow
-- allows, by the correct party, only once genuinely paid.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_gig_order_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.amount IS DISTINCT FROM OLD.amount
    OR NEW.razorpay_order_id IS DISTINCT FROM OLD.razorpay_order_id
    OR NEW.razorpay_payment_id IS DISTINCT FROM OLD.razorpay_payment_id
    OR NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
    RAISE EXCEPTION 'Payment fields can only be set by the payment webhook';
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

DROP TRIGGER IF EXISTS gig_orders_enforce_transition ON public.gig_orders;
CREATE TRIGGER gig_orders_enforce_transition
  BEFORE UPDATE ON public.gig_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_gig_order_transition();

-- ------------------------------------------------------------
-- SEC-020: company_reviews' own migration comment already documented
-- "anonymity is an app-layer display choice, not an access-control
-- one" -- correct as a description, but the audit is right that this
-- means anyone can deanonymize every "anonymous" review with a direct
-- ?select=reviewer_id,rating call, which defeats the entire point of
-- the feature for anyone who checks. Column-level REVOKE makes the
-- column genuinely unreadable by anon/authenticated regardless of what
-- they ask PostgREST to select -- RLS row-visibility is unaffected, the
-- review itself stays public, just not who wrote it.
-- ------------------------------------------------------------
REVOKE SELECT ON public.company_reviews FROM anon, authenticated;
GRANT SELECT (id, company_id, rating, review_text, created_at) ON public.company_reviews TO anon, authenticated;
-- INSERT/DELETE (058 has policies for both, no UPDATE) re-affirmed
-- explicitly -- a reviewer still needs to write reviewer_id to submit
-- their own review and satisfy the uniqueness constraint; only SELECT
-- is column-narrowed.
GRANT INSERT ON public.company_reviews TO authenticated;
GRANT DELETE ON public.company_reviews TO authenticated;

NOTIFY pgrst, 'reload schema';
