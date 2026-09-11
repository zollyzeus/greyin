-- ============================================================
-- Admin Overview tab: one round-trip aggregate-counts function
-- ============================================================
--
-- The consolidated admin panel's new Overview tab (Phase 3, pitch-
-- readiness plan) needs lightweight moderation-volume counts across all
-- 7 apps that no existing report function covers (get_bias_audit_report,
-- get_job_recommendation_feedback_report, get_latest_market_intelligence_report,
-- and get_threshold_vote_summary are all narrower, feature-specific
-- reports). Admin-gated INSIDE the function body, not by the caller --
-- this is called from an admin's own authenticated browser session
-- (the Overview page), the same situation get_latest_market_intelligence_report()
-- (130) is in, not the service-role-timer situation
-- compute_market_intelligence_stats() (131) is in -- see that
-- migration's own header comment for why the distinction matters (a
-- service-role caller has no auth.uid() at all, so a gate there would
-- unconditionally raise).
--
-- Run this after 140_longlist_admin_policies.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_admin_overview_counts()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT jsonb_build_object(
    'open_jobs', (SELECT count(*) FROM jobs WHERE status = 'open'),
    'active_gigs', (SELECT count(*) FROM gigs WHERE status NOT IN ('closed', 'archived')),
    'pending_payouts', (SELECT count(*) FROM payout_requests WHERE status IN ('pending', 'processing')),
    'disputed_orders', (SELECT count(*) FROM gig_orders WHERE status = 'disputed'),
    'flagged_discussions', (SELECT count(*) FROM discussions WHERE moderation_status IN ('pending_check', 'flagged_on_retry')),
    'flagged_replies', (SELECT count(*) FROM discussion_replies WHERE moderation_status IN ('pending_check', 'flagged_on_retry')),
    'open_future_roles', (SELECT count(*) FROM future_roles WHERE status = 'open'),
    'total_referral_conversions', (SELECT count(*) FROM reputation_events WHERE event_type = 'referral_converted'),
    'total_users', (SELECT count(*) FROM profiles)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_overview_counts() TO authenticated;

NOTIFY pgrst, 'reload schema';
