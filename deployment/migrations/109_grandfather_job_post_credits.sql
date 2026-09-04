-- ============================================================
-- Grandfather every existing DeepEdge company onto a free 'basic'
-- hiring tier, ahead of enforcing job_post credits on job creation
-- ============================================================
--
-- FR-EE-16 (traceability workbook) flagged job_post as "schema-ready,
-- not yet enforced" -- 096_tiered_subscriptions_and_credits.sql's own
-- comment claimed it was "wired to real, already-existing features
-- this pass", but apps/deepedge/src/app/api/jobs/create/route.ts never
-- actually called consume_credit; job posting has been completely
-- free since launch. Confirmed via direct query before writing this:
-- company_subscriptions had zero rows platform-wide, while 10 of 18
-- real companies already have 25 real open jobs live. Enforcing the
-- same gate profile_view already uses, with no grandfathering, would
-- have locked every one of them out of posting on the very next
-- deploy -- a real monetization launch decision, not a bug fix, so
-- this was confirmed with the user before writing any code.
--
-- User-directed: grandfather every company that exists as of this
-- migration onto a free 'basic' deepedge_hiring tier (3 job_post
-- credits/month, the tier's own already-seeded allowance) so nobody
-- currently posting is locked out; new/future companies are
-- deliberately NOT covered here and must genuinely subscribe via
-- /subscribe to post at all, once the app-layer enforcement below
-- ships in the same deploy.
--
-- plan_id is a NOT NULL legacy FK to subscription_plans (039, predates
-- the tier system) -- 'starter' is the closest semantic fit for an
-- unpaid grandfathered grant; it plays no role in credit calculation,
-- which reads tier_id only.
--
-- Run this after 108_pillar_activity_longlist.sql
-- ============================================================

INSERT INTO public.company_subscriptions (company_id, plan_id, tier_id, status, activated_at)
SELECT
  c.id,
  (SELECT id FROM public.subscription_plans WHERE tier = 'starter'),
  (SELECT id FROM public.subscription_tiers WHERE product = 'deepedge_hiring' AND tier_key = 'basic'),
  'active',
  now()
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_subscriptions cs WHERE cs.company_id = c.id
);
