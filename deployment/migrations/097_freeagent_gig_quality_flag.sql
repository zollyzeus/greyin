-- ============================================================
-- Gap-audit item #4: gig-listing AI quality assist at post-time
-- (FreeAgent, stateless/on-demand, informational only -- see
-- apps/freeagent-marketplace/src/lib/gig-quality.ts and
-- api/gigs/quality-check/route.ts). Just the feature-flag row --
-- llm_providers/llm_feature_flags already exist (migration 031),
-- and complete() looks up this feature_key at call time.
-- ============================================================

INSERT INTO public.llm_feature_flags (feature_key, enabled)
VALUES ('freeagent_gig_quality', true)
ON CONFLICT (feature_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
