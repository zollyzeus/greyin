-- Feedback loop for DeepEdge's job recommendations (121). Three phases:
--  1. Capture + immediate exclusion -- this table, self-managed only.
--  2. Personalize the two LLM-ranked sections using a candidate's own
--     recent negative feedback as a hint (lib/job-recommendations.ts).
--  3. Admin-visible aggregate quality signal, aggregate-only like
--     get_bias_audit_report() -- never a row traceable to one person's
--     specific opinion about a specific job.

CREATE TABLE job_recommendation_feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL CHECK (recommendation_type IN ('profile', 'history', 'preferences', 'top_candidate')),
  feedback text NOT NULL CHECK (feedback IN ('helpful', 'not_relevant', 'already_applied', 'wrong_fit')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One opinion per (user, job) -- feedback is fundamentally about the
  -- job, not which of the 4 sections happened to surface it; a second
  -- submission for the same job updates the first rather than stacking.
  UNIQUE (user_id, job_id)
);

CREATE INDEX idx_job_recommendation_feedback_user ON job_recommendation_feedback(user_id);

ALTER TABLE job_recommendation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own recommendation feedback"
  ON job_recommendation_feedback FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- No admin/broad SELECT policy -- Phase 3's admin report reads through
-- get_job_recommendation_feedback_report() below (aggregate counts
-- only), the same discipline profile_demographics/ai_match_audit_log
-- already established.

-- Phase 3: per-recommendation-type helpful/not-helpful rates. Never
-- returns a row traceable to one person's opinion about one job -- only
-- counts, grouped by type and feedback value.
CREATE OR REPLACE FUNCTION get_job_recommendation_feedback_report()
RETURNS TABLE (
  recommendation_type text,
  helpful_count bigint,
  not_relevant_count bigint,
  already_applied_count bigint,
  wrong_fit_count bigint,
  total_count bigint,
  helpful_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  SELECT
    f.recommendation_type,
    count(*) FILTER (WHERE f.feedback = 'helpful') AS helpful_count,
    count(*) FILTER (WHERE f.feedback = 'not_relevant') AS not_relevant_count,
    count(*) FILTER (WHERE f.feedback = 'already_applied') AS already_applied_count,
    count(*) FILTER (WHERE f.feedback = 'wrong_fit') AS wrong_fit_count,
    count(*) AS total_count,
    round(count(*) FILTER (WHERE f.feedback = 'helpful')::numeric / count(*), 4) AS helpful_rate
  FROM job_recommendation_feedback f
  GROUP BY f.recommendation_type
  ORDER BY f.recommendation_type;
END;
$$;
