-- Phase B1 of the "11 new AI enhancements" plan -- this flag was missed
-- from migration 126 (which covered Phase A's 3 flags) when B1's own
-- lib/interview-prep.ts was written; caught live by
-- ai-interview-prep.spec.ts returning "AI suggestions are unavailable
-- right now" (complete() treats a missing llm_feature_flags row the
-- same as a disabled one).
INSERT INTO llm_feature_flags (feature_key, enabled) VALUES
  ('deepedge_interview_prep', true)
ON CONFLICT (feature_key) DO NOTHING;
