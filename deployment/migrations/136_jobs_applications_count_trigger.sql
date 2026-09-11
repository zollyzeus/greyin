-- ============================================================
-- jobs.applications_count: make it a real, maintained counter
-- ============================================================
--
-- Found via a pitch-demo scrutiny pass, not guessed at: jobs.applications_count
-- has existed since 001_initial_schema.sql and is read directly by
-- job-recommendations.ts's findTopCandidateJobs() ("No applicants yet" /
-- "Only N applicants so far" scarcity signal) and rendered in the
-- recommendation reasons text -- but nothing anywhere, not even the real
-- apply-to-job route, has ever incremented it. It stayed invisible only
-- because every job's real applications count was also 0 -- once a demo-
-- data seeding pass added real applications directly via SQL, the gap
-- became externally checkable: the AI recommendation card would say "No
-- applicants yet" for a job that demonstrably has applicants in its own
-- pipeline. Same maintained-counter pattern already used for
-- builder_projects.upvote_count (009_saltnpepper_community.sql) and
-- feature_requests.upvote_count (101_wishlist_and_feedback.sql) --
-- applied here for the first time to jobs.applications_count specifically
-- so it can never go stale again, for seeded OR real future applications.
--
-- Run this after 001_initial_schema.sql (applications table must exist).
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_job_applications_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.jobs
  SET applications_count = (
    SELECT COUNT(*) FROM public.applications
    WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
  )
  WHERE id = COALESCE(NEW.job_id, OLD.job_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_job_applications_count_insert_trigger
AFTER INSERT ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.update_job_applications_count();

CREATE TRIGGER update_job_applications_count_delete_trigger
AFTER DELETE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.update_job_applications_count();

-- job_id itself is immutable in practice (no UI ever re-targets an
-- existing application to a different job), so no UPDATE OF job_id
-- trigger is needed -- INSERT/DELETE cover every real state change.

-- One-time backfill so every job's counter reflects real history right
-- now, not just future changes from here on.
UPDATE public.jobs j
SET applications_count = (
  SELECT COUNT(*) FROM public.applications a WHERE a.job_id = j.id
);

NOTIFY pgrst, 'reload schema';
