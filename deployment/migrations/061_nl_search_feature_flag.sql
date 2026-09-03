-- ============================================================
-- Natural-language ecosystem search: feature flag registration
-- ============================================================
--
-- Reuses the existing llm_providers/llm_feature_flags infrastructure
-- (048_ai_quality_scores.sql) -- no new AI vendor integration, just a
-- new feature_key row so complete('ecosystem_nl_search', ...) has a
-- flag to check, same convention as
-- freeagent_delivery_quality/stackedge_verification/
-- saltnpepper_reply_quality/greymatters_post_quality.
-- provider_id left NULL -- uses whichever enabled provider has top
-- priority, same as every other feature key that doesn't pin one.
--
-- Run this after 060_platform_people_index.sql
-- ============================================================

INSERT INTO public.llm_feature_flags (feature_key, enabled)
VALUES ('ecosystem_nl_search', true)
ON CONFLICT (feature_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
