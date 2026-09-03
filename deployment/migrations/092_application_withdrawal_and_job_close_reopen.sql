-- ============================================================
-- Application withdrawal + employer self-service job close/reopen
-- ============================================================
--
-- Both gaps flagged by the Emergent comparison audit
-- (docs/emergent_deployment_gap.md, items #1 and #2):
--   - applications.status already had a 'withdrawn' enum value and
--     the UI even had a CSS class for it (dashboard/applications/
--     page.tsx's STATUS_STYLES) -- but no RLS policy ever let a
--     candidate set their own application's status at all, only the
--     employer could ("Companies can update application status",
--     001). Never finished, not a design decision.
--   - jobs.status already had 'closed', and jobs' own RLS ("Company
--     owners can update their jobs", 003) already lets an employer
--     update ANY field on their own job unrestricted -- close/reopen
--     needed no schema or RLS change at all, only routes + UI. The
--     only route that ever set status='closed' was admin-only
--     (api/admin/jobs/close), leaving an employer with no self-service
--     path to close their own filled role, and no reopen route
--     existed anywhere, admin or otherwise.
--
-- Run this after 091_peer_project_reciprocity_flags.sql
-- ============================================================

-- Candidates can withdraw their own application -- scoped narrowly to
-- exactly that one transition, not a general self-service status
-- editor: USING lets them touch only their own rows; WITH CHECK
-- requires the resulting status be 'withdrawn' specifically, so this
-- can never be used to self-promote to 'accepted' or otherwise forge
-- an employer's status update. One-way by design (no un-withdraw) --
-- matches the audit's own scoped ask; a candidate who changes their
-- mind can't re-apply either (applications' own UNIQUE(job_id,
-- candidate_id) constraint blocks a second row for the same job),
-- flagged here as a known follow-up limitation, not fixed by this
-- migration.
CREATE POLICY "Candidates can withdraw their own application"
  ON public.applications FOR UPDATE
  USING (candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid()))
  WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
    AND status = 'withdrawn'
  );

-- The employer sees a withdrawal happen without needing to notice it
-- on their own applications list -- same "notify the other side of a
-- state change" convention as every other cross-user action on this
-- platform (written_recommendations, peer_project tags, etc).
CREATE OR REPLACE FUNCTION public.notify_application_withdrawn()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_employer_id UUID;
  v_job_title TEXT;
  v_candidate_name TEXT;
BEGIN
  IF NEW.status = 'withdrawn' AND OLD.status IS DISTINCT FROM 'withdrawn' THEN
    SELECT j.title, c.user_id INTO v_job_title, v_employer_id
    FROM public.jobs j JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = NEW.job_id;
    SELECT full_name INTO v_candidate_name FROM public.profiles
    WHERE id = (SELECT user_id FROM public.candidates WHERE id = NEW.candidate_id);
    IF v_employer_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (v_employer_id, 'application_withdrawn', 'Application withdrawn',
              COALESCE(v_candidate_name, 'A candidate') || ' withdrew their application for "' || COALESCE(v_job_title, 'a role') || '"',
              '/employer/jobs/' || NEW.job_id || '/applications');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_application_withdrawn
  AFTER UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_withdrawn();

-- Job closing affects every candidate with a still-open application in
-- flight -- notify them their application is now moot, rather than
-- leaving them to find out by revisiting a job page that quietly
-- stopped accepting anyone. Deliberately scoped to non-terminal
-- statuses (not already accepted/rejected/withdrawn, where a "job
-- closed" notice adds nothing).
CREATE OR REPLACE FUNCTION public.notify_applicants_job_closed()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app RECORD;
BEGIN
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    FOR v_app IN
      SELECT c.user_id
      FROM public.applications a
      JOIN public.candidates c ON c.id = a.candidate_id
      WHERE a.job_id = NEW.id
        AND a.status NOT IN ('accepted', 'rejected', 'withdrawn')
    LOOP
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (v_app.user_id, 'job_closed', 'A role you applied to has closed',
              '"' || NEW.title || '" is no longer accepting applications', '/dashboard/applications');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_job_closed
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_applicants_job_closed();

NOTIFY pgrst, 'reload schema';
