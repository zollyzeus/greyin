-- Phase C of the "11 new AI enhancements" plan (2026-09-07): the
-- cross-pillar moat features. All 3 flags added together this time
-- (Phase B's own migration missed one, caught live -- see 128's comment).
INSERT INTO llm_feature_flags (feature_key, enabled) VALUES
  ('deepedge_skill_dossier', true),
  ('greyin_hub_career_path', true),
  ('greyin_hub_market_intelligence', true)
ON CONFLICT (feature_key) DO NOTHING;
