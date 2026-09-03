-- ============================================================
-- SEC-026 (2026-08-26 security audit): platform_search_index runs as
-- its owner (postgres) by default, bypassing every underlying table's
-- RLS -- and it's GRANTed SELECT to anon (024). 024's own comment
-- explicitly said discussions/projects had to stay excluded from this
-- view for exactly this reason ("gated to authenticated community
-- members... a public search index bypassing that via a SECURITY
-- DEFINER-style view would leak it to anonymous visitors"), but 037
-- added them anyway without ever revisiting that constraint --
-- discussions and builder_projects both correctly require
-- auth.role()='authenticated' at the RLS level, but the view's owner-
-- privilege default bypasses it, so anon (and even an authenticated-
-- but-not-a-member caller, if that distinction mattered here) reads
-- them straight through the "public" search index anyway.
--
-- Same root cause also leaks posts more narrowly than intended: posts'
-- own RLS restricts published rows by view_audience (public/follower/
-- verified_expert), but the view's WHERE only checks status='published',
-- so follower- and verified-expert-only posts were also reachable via
-- search regardless of who's asking.
--
-- Fixed the same way as SEC-013's collaborators view (067): make the
-- view respect the querying role's own RLS instead of running with the
-- owner's bypass privileges. jobs (open/filled) and gigs (active) both
-- have genuinely public SELECT policies already, so this doesn't change
-- what a real anonymous visitor legitimately sees for those two pillars.
--
-- Run this after 078_fix_subscription_plans_rls.sql
-- ============================================================

ALTER VIEW public.platform_search_index SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';
