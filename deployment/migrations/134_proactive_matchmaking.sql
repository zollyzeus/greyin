-- ============================================================
-- Two-sided proactive matchmaking (Phase D3, "11 new AI enhancements"
-- plan)
-- ============================================================
--
-- The plan originally flagged this item for deferral: it seemed to need
-- a genuinely new employer-side "ideal candidate criteria" capture step
-- that doesn't exist anywhere today. Re-scoped on user request rather
-- than building that new capture step: an OPEN job posting already IS a
-- structured ideal-candidate-criteria capture (skills_required,
-- experience_min, remote_type, location) -- reusing it directly avoids
-- inventing new schema/UI for something that already exists in
-- substance, just not in name. This is the same deterministic matching
-- bar findTopCandidateJobs() (job-recommendations.ts, 121) already shows
-- candidates on /jobs's "Where you'd be a top candidate" section:
-- experience_min gate + >=50% required-skills overlap -- ported into SQL
-- here so it can run as a lazy sweep with no LLM call, same
-- "page-load-triggered sweep, no pg_cron" convention as
-- sweep_salary_trend_alerts() (063).
--
-- The genuinely new part -- and the actual point of D3 -- is that this
-- fires for BOTH sides without either one searching: a candidate who
-- never looked at /jobs still gets notified about a real match, and an
-- employer who never reviewed /candidates still gets notified that
-- qualified people exist who haven't applied. sweep_salary_trend_alerts'
-- own "notify once per material change, not every sweep" discipline is
-- carried over via a dedup table rather than a percent-change threshold.
--
-- Run this after 121_deepedge_job_recommendations (job-recommendations
-- feature must exist first: this reuses its own matching bar) and 125
-- (job_recommendation_feedback -- excluded from candidate-side matches
-- below, same as the recommendation lists themselves).
-- ============================================================

CREATE TABLE public.proactive_match_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('candidate', 'employer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_user_id, side)
);

-- No client-facing SELECT/INSERT policy at all -- this is a pure dedup
-- ledger for the two SECURITY DEFINER sweep functions below, never read
-- directly by any page (same "no client access, sweep-function-only"
-- posture as market_intelligence_reports, 130).
ALTER TABLE public.proactive_match_notifications ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Candidate side: "a job matches your profile, and you haven't seen it"
-- -- scoped to the CALLING candidate, same auth.uid()-scoped lazy-sweep
-- shape as sweep_salary_trend_alerts(). Capped at 3 new notifications
-- per call so a candidate visiting /dashboard daily isn't flooded the
-- first time this ships against a backlog of every already-open job.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_proactive_job_matches_for_candidate()
RETURNS void
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_candidate RECORD;
  v_job RECORD;
  v_notified INTEGER := 0;
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
      AND (j.experience_min IS NULL OR v_candidate.experience_years >= j.experience_min)
      AND (
        array_length(j.skills_required, 1) IS NULL
        OR (
          SELECT count(*)::numeric FROM unnest(j.skills_required) req
          WHERE EXISTS (SELECT 1 FROM unnest(v_candidate.skills) s WHERE lower(s) = lower(req))
        ) / array_length(j.skills_required, 1) >= 0.5
      )
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

    v_notified := v_notified + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.sweep_proactive_job_matches_for_candidate() TO authenticated;

-- ------------------------------------------------------------
-- Employer side: "qualified candidates exist for your job and haven't
-- applied" -- scoped to the CALLING employer's own companies/jobs. One
-- notification per job per sweep (never one per candidate -- that would
-- spam an employer with a popular job), naming only the COUNT of newly
-- surfaced matches; the link goes to the job's own applications page,
-- where AI-Verified Search already exists for the employer to actually
-- find them (matching this session's "AI-moat explainable search"
-- work -- no new candidate-listing UI needed here either).
-- ------------------------------------------------------------
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
    WHERE co.user_id = auth.uid() AND j.status = 'open'
  LOOP
    v_new_count := 0;

    FOR v_candidate IN
      SELECT c.* FROM public.candidates c
      WHERE (v_job.experience_min IS NULL OR c.experience_years >= v_job.experience_min)
        AND (
          array_length(v_job.skills_required, 1) IS NULL
          OR (
            SELECT count(*)::numeric FROM unnest(v_job.skills_required) req
            WHERE EXISTS (SELECT 1 FROM unnest(c.skills) s WHERE lower(s) = lower(req))
          ) / array_length(v_job.skills_required, 1) >= 0.5
        )
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

GRANT EXECUTE ON FUNCTION public.sweep_proactive_candidate_matches_for_employer() TO authenticated;

NOTIFY pgrst, 'reload schema';
