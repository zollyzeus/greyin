-- ============================================================
-- SEC-027 (2026-08-26 security audit): activity_feed's own migration
-- comment (053) claims "security comes entirely from each UNIONed
-- table's own existing RLS still applying per-invoker" -- but that was
-- never actually true, the view was never given security_invoker=true,
-- so it ran with the owner's (postgres) bypass privileges the whole
-- time. Same bug class as SEC-026's platform_search_index. Concretely:
-- posts' own RLS restricts published rows by view_audience (public/
-- follower/verified_expert), but a follower who isn't a Verified Expert
-- could still see a verified_expert-only post from someone they follow
-- via the activity feed. Confirmed via a rolled-back transaction with
-- fabricated test data: a non-verified follower saw the VE-only post
-- before this fix, and correctly got 0 rows after.
--
-- Run this after 079_fix_platform_search_index_visibility.sql
-- ============================================================

ALTER VIEW public.activity_feed SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';
