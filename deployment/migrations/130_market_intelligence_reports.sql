-- Phase C3 of the "11 new AI enhancements" plan (2026-09-07): admin-only
-- aggregate market-intelligence reports. Unlike C1/C2 (live/on-demand),
-- this aggregates over the WHOLE platform, so it's generated on a
-- schedule (a second interval on greyin-hub's existing instrumentation.ts
-- timer, alongside refresh_platform_score_means() from 122) and just read
-- by the admin page, not recomputed per view.

CREATE TABLE public.market_intelligence_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  report_text TEXT NOT NULL,
  raw_stats JSONB NOT NULL
);

ALTER TABLE public.market_intelligence_reports ENABLE ROW LEVEL SECURITY;
-- Deliberately no SELECT policy for any client role -- the admin page
-- reads via get_latest_market_intelligence_report() below (SECURITY
-- DEFINER, admin-role-checked), same "no direct table access" discipline
-- as get_bias_audit_report()/get_job_recommendation_feedback_report().
-- Writes happen only from the service-role timer in instrumentation.ts.

-- Computes the raw aggregate stats (no LLM call -- this is plain SQL,
-- called from the app-level timer, which then hands the jsonb result to
-- an LLM to turn into a narrative report_text). Admin-only, same as the
-- report-read function below, since even the raw aggregate shouldn't be
-- pollable by a non-admin client.
CREATE OR REPLACE FUNCTION compute_market_intelligence_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'top_skills_in_demand', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('skill', skill, 'job_count', job_count) ORDER BY job_count DESC), '[]'::jsonb)
      FROM (
        SELECT skill, count(*) AS job_count
        FROM public.jobs, unnest(skills_required) AS skill
        WHERE status IN ('open', 'filled') AND created_at > now() - interval '90 days'
        GROUP BY skill
        ORDER BY job_count DESC
        LIMIT 10
      ) t
    ),
    'hiring_velocity', jsonb_build_object(
      'jobs_posted_last_30d', (SELECT count(*) FROM public.jobs WHERE created_at > now() - interval '30 days'),
      'jobs_posted_prior_30d', (SELECT count(*) FROM public.jobs WHERE created_at > now() - interval '60 days' AND created_at <= now() - interval '30 days'),
      'jobs_filled_last_30d', (SELECT count(*) FROM public.jobs WHERE status = 'filled' AND updated_at > now() - interval '30 days'),
      'avg_applications_per_open_job', (SELECT COALESCE(round(avg(applications_count), 1), 0) FROM public.jobs WHERE status = 'open')
    ),
    'salary_trends_sample', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'role_title', role_title, 'experience_bucket', experience_bucket, 'source', source,
        'avg_salary_low', avg_salary_low, 'avg_salary_high', avg_salary_high, 'sample_size', sample_size
      ) ORDER BY sample_size DESC), '[]'::jsonb)
      FROM (
        SELECT role_title, experience_bucket, source, avg_salary_low, avg_salary_high, sample_size
        FROM public.salary_trends
        WHERE period > now() - interval '180 days'
        ORDER BY sample_size DESC
        LIMIT 15
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Admin reads only the latest report -- same shape as
-- get_job_recommendation_feedback_report(), just returning one row
-- instead of an aggregate table.
CREATE OR REPLACE FUNCTION get_latest_market_intelligence_report()
RETURNS TABLE (
  generated_at TIMESTAMPTZ,
  report_text TEXT,
  raw_stats JSONB
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
  SELECT r.generated_at, r.report_text, r.raw_stats
  FROM market_intelligence_reports r
  ORDER BY r.generated_at DESC
  LIMIT 1;
END;
$$;

NOTIFY pgrst, 'reload schema';
