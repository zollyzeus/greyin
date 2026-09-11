-- Phase B2 of the "11 new AI enhancements" plan (2026-09-07): AI-
-- generated-content authenticity scoring, starting narrow with
-- GreyMatters posts (the most mature ai_quality_scores pipeline, and its
-- own prompt already judges "technical moat... a shallow AI-generated
-- summary couldn't match"). Reuses the exact same LLM call already
-- happening at publish/update time -- no new API cost, just one more
-- line in the existing SCORE:/NOTES: response format. Informational/
-- moderation-queue only: never auto-rejects or auto-hides a post.
ALTER TABLE ai_quality_scores
  ADD COLUMN authenticity_flag text
  CHECK (authenticity_flag IN ('likely_original', 'possibly_ai_generated'));
