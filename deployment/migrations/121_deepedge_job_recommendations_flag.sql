-- AI enhancement: personalized job recommendations on DeepEdge's /jobs
-- browse page, the candidate-side mirror of the employer-side AI-Verified
-- Search / Longlist matching that already existed. Two of the four
-- recommendation angles are genuine LLM ranking (profile-based,
-- application-history-based -- free-text semantic judgment calls) and
-- gated by this flag; the other two (stated preferences, "where you'd be
-- a top candidate") are deterministic structured comparisons with no LLM
-- call at all, same reasoning as explainPersonMatch() (117/AI-moat
-- explainable-search work) -- a literal field-to-field match is more
-- honestly explainable as a checklist than as an AI guess, so they always
-- run regardless of this flag.
INSERT INTO llm_feature_flags (feature_key, enabled)
VALUES ('deepedge_job_recommendations', true)
ON CONFLICT (feature_key) DO NOTHING;
