-- ============================================================
-- Dedicated, harmless feature flag for admin-llm.spec.ts
-- ============================================================
--
-- admin-llm.spec.ts exercises the admin panel's feature-flag toggle UI
-- by disabling then re-enabling a real flag. It used to toggle
-- stackedge_verification -- fine when that was the only flag, but
-- 048_ai_quality_scores.sql added three more (greymatters_post_quality,
-- saltnpepper_reply_quality, freeagent_delivery_quality), and now every
-- flag has its own e2e spec that depends on AI review actually being
-- enabled. Toggling any of them off, even briefly, is a real race
-- against whichever of those specs happens to run concurrently in
-- another worker.
--
-- This flag is read by no application code anywhere -- it exists solely
-- so the toggle-UI test has something to flip with zero effect on any
-- other test or on real behavior.
--
-- Run this after 048_ai_quality_scores.sql
-- ============================================================

INSERT INTO public.llm_feature_flags (feature_key, enabled) VALUES
  ('e2e_admin_panel_toggle_test', true);

NOTIFY pgrst, 'reload schema';
