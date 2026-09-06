-- AI moat roadmap item: AI-powered mentor matching (Coaching). Live,
-- per-request LLM ranking of /mentor-sessions gigs against the viewer's
-- own future_interests (087) -- no new table, nothing to persist (same
-- posture as parse-search-query.ts's real-time NL-search ranking, 048).
INSERT INTO llm_feature_flags (feature_key, enabled)
VALUES ('flexpro_mentor_matching', true)
ON CONFLICT (feature_key) DO NOTHING;
