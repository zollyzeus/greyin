-- AI moat roadmap item: bias/fairness auditing on AI matching output
-- (pitch-deck review, 2026-09-01). Real disparate-impact measurement
-- needs demographic data, which this platform has never collected --
-- scoped per explicit user decision 2026-09-05 to add optional,
-- self-disclosed fields (standard EEO-survey pattern), never shown to
-- employers, never used as matching input, aggregate-only visibility.
--
-- Kept in its own table rather than added to `profiles` deliberately:
-- profiles is read broadly across the whole platform (name, skills,
-- etc. are legitimately public-ish), and putting sensitive self-ID data
-- in the same row would make it one careless `select('*')` away from
-- exposure. This table has no admin SELECT policy on it at all -- the
-- only read path for anyone other than the user themselves is
-- get_bias_audit_report() below, which returns aggregates only, never a
-- row that could be tied back to one person.

CREATE TABLE profile_demographics (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  gender text CHECK (gender IN ('woman', 'man', 'non_binary', 'self_describe', 'prefer_not_to_say')),
  gender_self_description text,
  age_range text CHECK (age_range IN ('under_25', '25_34', '35_44', '45_54', '55_64', '65_plus', 'prefer_not_to_say')),
  disability_status text CHECK (disability_status IN ('yes', 'no', 'prefer_not_to_say')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profile_demographics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage only their own demographic data"
  ON profile_demographics FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Append-only log of who an AI-matching feature actually surfaced and
-- when -- without this there is no history to audit at all (Longlist's
-- AI matching, lib/match-candidates.ts, is a live per-request call with
-- no persistence). No RLS SELECT policy for anyone: written by the
-- service role from app code, read only through the aggregate function.
CREATE TABLE ai_match_audit_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_key text NOT NULL,
  subject_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  context_id uuid,
  surfaced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_match_audit_log_feature ON ai_match_audit_log(feature_key);
CREATE INDEX idx_ai_match_audit_log_subject ON ai_match_audit_log(subject_user_id);

ALTER TABLE ai_match_audit_log ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies at all -- RLS enabled with zero policies
-- denies all access via the normal client roles; only the service role
-- (writes) and this SECURITY DEFINER function (reads) can touch it.

-- Standard EEOC "four-fifths rule" style comparison: for a given
-- AI-matching feature, compares each demographic bucket's share of
-- people actually surfaced against its share of the eligible pool
-- (platform_people_index members with stated future_interests, the
-- same pool matchCandidatesForRole() itself draws from). A bucket whose
-- selection rate is under 80% of the best-performing bucket's rate is
-- flagged -- never exposes a single row, only per-bucket aggregate
-- counts, and only to admins.
CREATE OR REPLACE FUNCTION get_bias_audit_report(p_feature_key text)
RETURNS TABLE (
  dimension text,
  bucket text,
  eligible_count bigint,
  surfaced_count bigint,
  selection_rate numeric,
  four_fifths_ratio numeric,
  flagged boolean
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
  WITH eligible AS (
    SELECT ppi.user_id, COALESCE(pd.gender, 'not_disclosed') AS bucket
    FROM platform_people_index ppi
    LEFT JOIN profile_demographics pd ON pd.user_id = ppi.user_id
    WHERE ppi.future_interests <> '{}' OR ppi.future_interests_note IS NOT NULL
  ),
  surfaced AS (
    SELECT DISTINCT subject_user_id FROM ai_match_audit_log WHERE feature_key = p_feature_key
  ),
  per_bucket AS (
    SELECT
      e.bucket,
      COUNT(*) AS eligible_count,
      COUNT(*) FILTER (WHERE s.subject_user_id IS NOT NULL) AS surfaced_count
    FROM eligible e
    LEFT JOIN surfaced s ON s.subject_user_id = e.user_id
    GROUP BY e.bucket
  ),
  rated AS (
    SELECT
      bucket,
      eligible_count,
      surfaced_count,
      CASE WHEN eligible_count > 0 THEN ROUND(surfaced_count::numeric / eligible_count, 4) ELSE 0 END AS selection_rate
    FROM per_bucket
  )
  SELECT
    'gender'::text AS dimension,
    r.bucket,
    r.eligible_count,
    r.surfaced_count,
    r.selection_rate,
    CASE WHEN (SELECT MAX(selection_rate) FROM rated) > 0
      THEN ROUND(r.selection_rate / (SELECT MAX(selection_rate) FROM rated), 4)
      ELSE NULL
    END AS four_fifths_ratio,
    CASE WHEN (SELECT MAX(selection_rate) FROM rated) > 0
      THEN (r.selection_rate / (SELECT MAX(selection_rate) FROM rated)) < 0.8
      ELSE false
    END AS flagged
  FROM rated r
  ORDER BY r.bucket;
END;
$$;
