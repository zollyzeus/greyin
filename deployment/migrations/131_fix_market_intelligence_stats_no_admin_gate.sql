-- 130's compute_market_intelligence_stats() had an auth.uid()-based admin
-- check, copied from the admin-report-read functions -- but this function
-- is called by the SERVICE-ROLE periodic timer (instrumentation.ts), which
-- has no user JWT at all, so auth.uid() is always NULL there and the check
-- would unconditionally raise. Caught before ever wiring up the timer, by
-- checking refresh_platform_score_means() (122)'s own precedent for a
-- service-role-called function -- it has no such check. The admin gate
-- belongs only on get_latest_market_intelligence_report(), which IS called
-- from an admin's own authenticated browser session.
CREATE OR REPLACE FUNCTION compute_market_intelligence_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB;
BEGIN
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

NOTIFY pgrst, 'reload schema';
