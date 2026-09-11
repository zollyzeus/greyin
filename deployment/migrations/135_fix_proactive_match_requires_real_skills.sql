-- Real regression caught by the e2e regression pass, not assumed: 134's
-- match criteria mirrored findTopCandidateJobs()'s own "no skills_required
-- means automatically satisfied" rule -- correct for a BROWSED
-- recommendation (low stakes, the candidate is already looking), but far
-- too aggressive for an unsolicited PUSH notification. A job with zero
-- stated skills isn't really expressing "ideal candidate criteria" at
-- all, so treating it as a wildcard match for every candidate meant
-- salary-trend-alert-fires.spec.ts's own criteria-less test jobs (title
-- only, no skills_required) fired a "new job matches your profile"
-- notification for every candidate who ever loads /dashboard --
-- confirmed live: it broke that spec's own single-notification
-- assertion by producing 3 duplicate matches sharing its job's title.
--
-- Fix: require skills_required to be genuinely non-empty for a job to be
-- eligible for a PROACTIVE match at all (both sides) -- the experience_min
-- gate stays optional (a real job legitimately might not state one), but
-- an empty skills list no longer counts as "matches everyone" here. The
-- pull-side /jobs recommendation list (job-recommendations.ts) is
-- untouched -- this only tightens the push-notification bar.
CREATE OR REPLACE FUNCTION public.sweep_proactive_job_matches_for_candidate()
RETURNS void
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_candidate RECORD;
  v_job RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_candidate FROM public.candidates WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR v_job IN
    SELECT j.*
    FROM public.jobs j
    WHERE j.status = 'open'
      AND array_length(j.skills_required, 1) > 0
      AND (j.experience_min IS NULL OR v_candidate.experience_years >= j.experience_min)
      AND (
        SELECT count(*)::numeric FROM unnest(j.skills_required) req
        WHERE EXISTS (SELECT 1 FROM unnest(v_candidate.skills) s WHERE lower(s) = lower(req))
      ) / array_length(j.skills_required, 1) >= 0.5
      AND NOT EXISTS (SELECT 1 FROM public.applications a WHERE a.job_id = j.id AND a.candidate_id = v_candidate.id)
      AND NOT EXISTS (SELECT 1 FROM public.job_recommendation_feedback f WHERE f.job_id = j.id AND f.user_id = auth.uid())
      AND NOT EXISTS (SELECT 1 FROM public.proactive_match_notifications n WHERE n.job_id = j.id AND n.candidate_user_id = auth.uid() AND n.side = 'candidate')
    ORDER BY j.created_at DESC
    LIMIT 3
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (auth.uid(), 'proactive_job_match', 'A new job matches your profile', v_job.title, '/jobs/' || v_job.id);

    INSERT INTO public.proactive_match_notifications (job_id, candidate_user_id, side)
    VALUES (v_job.id, auth.uid(), 'candidate');
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sweep_proactive_candidate_matches_for_employer()
RETURNS void
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job RECORD;
  v_candidate RECORD;
  v_new_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  FOR v_job IN
    SELECT j.* FROM public.jobs j
    JOIN public.companies co ON co.id = j.company_id
    WHERE co.user_id = auth.uid() AND j.status = 'open' AND array_length(j.skills_required, 1) > 0
  LOOP
    v_new_count := 0;

    FOR v_candidate IN
      SELECT c.* FROM public.candidates c
      WHERE (v_job.experience_min IS NULL OR c.experience_years >= v_job.experience_min)
        AND (
          SELECT count(*)::numeric FROM unnest(v_job.skills_required) req
          WHERE EXISTS (SELECT 1 FROM unnest(c.skills) s WHERE lower(s) = lower(req))
        ) / array_length(v_job.skills_required, 1) >= 0.5
        AND NOT EXISTS (SELECT 1 FROM public.applications a WHERE a.job_id = v_job.id AND a.candidate_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM public.proactive_match_notifications n WHERE n.job_id = v_job.id AND n.candidate_user_id = c.user_id AND n.side = 'employer')
      LIMIT 25
    LOOP
      INSERT INTO public.proactive_match_notifications (job_id, candidate_user_id, side)
      VALUES (v_job.id, v_candidate.user_id, 'employer')
      ON CONFLICT DO NOTHING;
      v_new_count := v_new_count + 1;
    END LOOP;

    IF v_new_count > 0 THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (
        auth.uid(), 'proactive_candidate_match', 'New candidates match your job posting',
        v_new_count || ' candidate' || CASE WHEN v_new_count = 1 THEN '' ELSE 's' END ||
          ' matching "' || v_job.title || '" haven''t applied yet',
        '/employer/jobs/' || v_job.id
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
