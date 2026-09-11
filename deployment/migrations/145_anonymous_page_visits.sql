-- ============================================================
-- Anonymous page-visit tracking (Emergent-parity gap #2, part 2 of 2)
-- ============================================================
--
-- Emergent tracks anonymous landing-page visits with an admin trend
-- chart (/platform/visit + /admin/stats). Greyin's only traffic-adjacent
-- table, analytics_events (116), requires an authenticated user_id
-- (NOT NULL, WITH CHECK (auth.uid() = user_id)) -- categorically
-- incompatible with an anonymous writer, and semantically different in
-- kind (member behavioral events, not anonymous traffic). A SEPARATE
-- table, not an alter -- confirmed by reading 116 directly rather than
-- assuming a nullable column would be a safe bolt-on.
--
-- No PII captured -- just enough to count and trend: a path and a
-- timestamp, nothing else. RLS enabled with NO policies at all -- same
-- "no direct client access, only via SECURITY DEFINER functions"
-- convention as rate_limit_attempts (075).
--
-- Run this after 144_anonymous_wishlist_submission.sql
-- ============================================================

CREATE TABLE public.page_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;

-- record_page_visit(): no admin check -- called by anonymous visitors.
CREATE OR REPLACE FUNCTION public.record_page_visit(p_path TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO page_visits (path) VALUES (p_path);
END;
$$;

-- get_page_visit_trend(): admin-gated inside the function body, same
-- precedent as get_admin_overview_counts() (141) and
-- get_recent_transactions() (143) -- called from an admin's own
-- authenticated browser session (the Overview tab), not a service-role
-- timer.
CREATE OR REPLACE FUNCTION public.get_page_visit_trend(p_days INT DEFAULT 30)
RETURNS TABLE (day DATE, visit_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT date_trunc('day', pv.occurred_at)::DATE AS day, count(*)::BIGINT AS visit_count
  FROM page_visits pv
  WHERE pv.occurred_at > now() - make_interval(days => p_days)
  GROUP BY 1
  ORDER BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_page_visit(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_visit_trend(INT) TO authenticated;

-- Public, unauthenticated write -- rate-limited looser than
-- wishlist_anonymous (mostly to bound a scripted flood, not to gate
-- normal browsing).
ALTER TABLE public.rate_limit_attempts DROP CONSTRAINT rate_limit_attempts_action_check;
ALTER TABLE public.rate_limit_attempts ADD CONSTRAINT rate_limit_attempts_action_check
  CHECK (action = ANY (ARRAY['password_reset', 'signup', 'demo_login', 'wishlist_anonymous', 'page_visit']));

NOTIFY pgrst, 'reload schema';
