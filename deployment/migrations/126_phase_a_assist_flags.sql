-- Phase A of the "11 new AI enhancements" plan (2026-09-07): three
-- assist-pattern features, each mirroring FlexPro's existing
-- GigQualityAssist/getGigListingSuggestions() shape (stateless, free,
-- never blocks the real submit action).
INSERT INTO llm_feature_flags (feature_key, enabled) VALUES
  ('deepedge_cover_letter_assist', true),
  ('deepedge_job_post_assist', true),
  ('saltnpepper_thread_summary', true)
ON CONFLICT (feature_key) DO NOTHING;
