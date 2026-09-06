-- Fixes a real bug in 119's get_bias_audit_report(): RETURNS TABLE
-- declares `bucket` as an OUT parameter, which PL/pgSQL treats as an
-- in-scope variable throughout the function body -- the `rated` CTE's
-- unqualified `SELECT bucket, ...` could resolve to either that
-- variable or per_bucket's own `bucket` column, so Postgres correctly
-- refused it as ambiguous ("column reference \"bucket\" is ambiguous"),
-- caught live by bias-audit.spec.ts. Same fix as everywhere else in the
-- function: qualify every reference to a table alias.
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
      e.bucket AS bucket,
      COUNT(*) AS eligible_count,
      COUNT(*) FILTER (WHERE s.subject_user_id IS NOT NULL) AS surfaced_count
    FROM eligible e
    LEFT JOIN surfaced s ON s.subject_user_id = e.user_id
    GROUP BY e.bucket
  ),
  rated AS (
    SELECT
      per_bucket.bucket AS bucket,
      per_bucket.eligible_count AS eligible_count,
      per_bucket.surfaced_count AS surfaced_count,
      CASE WHEN per_bucket.eligible_count > 0 THEN ROUND(per_bucket.surfaced_count::numeric / per_bucket.eligible_count, 4) ELSE 0 END AS selection_rate
    FROM per_bucket
  )
  SELECT
    'gender'::text AS dimension,
    r.bucket,
    r.eligible_count,
    r.surfaced_count,
    r.selection_rate,
    CASE WHEN (SELECT MAX(rated.selection_rate) FROM rated) > 0
      THEN ROUND(r.selection_rate / (SELECT MAX(rated.selection_rate) FROM rated), 4)
      ELSE NULL
    END AS four_fifths_ratio,
    CASE WHEN (SELECT MAX(rated.selection_rate) FROM rated) > 0
      THEN (r.selection_rate / (SELECT MAX(rated.selection_rate) FROM rated)) < 0.8
      ELSE false
    END AS flagged
  FROM rated r
  ORDER BY r.bucket;
END;
$$;
