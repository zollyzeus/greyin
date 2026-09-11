-- ============================================================
-- Admin transaction ledger: one function, 5 real payment sources
-- ============================================================
--
-- A fresh Emergent-comparison audit (2026-09-08) found Greyin has no
-- cross-platform view of recent payments -- each pillar's own admin
-- page (where one exists) only ever showed its own local data. Emergent
-- also has a payment-gateway toggle (Stripe<->Razorpay); that half is
-- deliberately NOT built here -- confirmed directly that Stripe doesn't
-- exist anywhere in Greyin (no SDK, no env vars, no schema), Razorpay is
-- the sole gateway across all 7 apps, so a toggle to a second gateway
-- that was never integrated would be fake, non-functional UI.
--
-- SECURITY DEFINER, admin-gated inside the function body (same
-- IF NOT EXISTS(...role='admin') THEN RAISE EXCEPTION precedent as
-- get_admin_overview_counts(), 141) -- this is called from an admin's
-- own authenticated browser session, not a service-role timer. Bypasses
-- each source table's own RLS by design (author_tips has no admin
-- SELECT policy today; that's fine, a SECURITY DEFINER function doesn't
-- need one).
--
-- Amounts are treated as INR throughout without a conversion step --
-- confirmed every real insert path across all 5 sources (orders/create,
-- subscriptions/checkout, razorpayx.ts, tips/create) hardcodes 'INR'
-- explicitly, even though gig_orders.currency still defaults to the
-- stale 'USD' template value from 001_initial_schema.sql.
--
-- company_subscriptions/flexpro_subscriptions join subscription_tiers
-- via tier_id for the real current price, NOT subscription_plans via
-- plan_id -- plan_id only exists to satisfy a pre-existing NOT NULL FK
-- (096's own migration comment); tier_id is what pricing actually keys
-- off since that migration shipped (confirmed again today during the
-- SEC-041 fix).
--
-- Run this after 142_fix_future_roles_posted_by_cascade.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_recent_transactions(p_limit INT DEFAULT 50)
RETURNS TABLE (
  transaction_type TEXT,
  amount_inr NUMERIC,
  status TEXT,
  occurred_at TIMESTAMPTZ,
  description TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  WITH combined AS (
    (
      SELECT
        'gig_order'::TEXT AS transaction_type,
        o.amount::NUMERIC AS amount_inr,
        COALESCE(o.status, 'pending') AS status,
        o.created_at AS occurred_at,
        'Gig order: ' || COALESCE(g.title, 'Unknown gig') AS description
      FROM gig_orders o
      LEFT JOIN gigs g ON g.id = o.gig_id
      ORDER BY o.created_at DESC
      LIMIT p_limit
    )
    UNION ALL
    (
      SELECT
        'payout'::TEXT,
        p.amount::NUMERIC,
        p.status,
        COALESCE(p.processed_at, p.requested_at) AS sort_ts,
        'Freelancer payout: ' || p.bank_account_name
      FROM payout_requests p
      ORDER BY sort_ts DESC
      LIMIT p_limit
    )
    UNION ALL
    (
      SELECT
        'subscription'::TEXT,
        COALESCE(st.price_inr, sp.price_inr, 0)::NUMERIC,
        cs.status,
        COALESCE(cs.activated_at, cs.created_at) AS sort_ts,
        'DeepEdge subscription: ' || COALESCE(c.name, 'Unknown company') ||
          CASE WHEN st.name IS NOT NULL THEN ' (' || st.name || ')' ELSE '' END
      FROM company_subscriptions cs
      LEFT JOIN subscription_tiers st ON st.id = cs.tier_id
      LEFT JOIN subscription_plans sp ON sp.id = cs.plan_id
      LEFT JOIN companies c ON c.id = cs.company_id
      ORDER BY sort_ts DESC
      LIMIT p_limit
    )
    UNION ALL
    (
      SELECT
        'subscription'::TEXT,
        COALESCE(st.price_inr, sp.price_inr, 0)::NUMERIC,
        fs.status,
        COALESCE(fs.activated_at, fs.created_at) AS sort_ts,
        'FlexPro posting subscription: ' || COALESCE(pr.full_name, pr.email, 'Unknown user')
      FROM flexpro_subscriptions fs
      LEFT JOIN subscription_tiers st ON st.id = fs.tier_id
      LEFT JOIN subscription_plans sp ON sp.id = fs.plan_id
      LEFT JOIN profiles pr ON pr.id = fs.user_id
      ORDER BY sort_ts DESC
      LIMIT p_limit
    )
    UNION ALL
    (
      SELECT
        'tip'::TEXT,
        t.amount::NUMERIC,
        t.status,
        t.created_at,
        'Tip to ' || COALESCE(author.full_name, author.email, 'Unknown author')
      FROM author_tips t
      LEFT JOIN profiles author ON author.id = t.author_id
      ORDER BY t.created_at DESC
      LIMIT p_limit
    )
  )
  SELECT * FROM combined
  ORDER BY occurred_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_transactions(INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
