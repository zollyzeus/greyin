-- ============================================================
-- StackEdge notifications
-- ============================================================
--
-- The shared notifications table (017) already covers ExpertEdge,
-- FreeAgent, GreyMatters, and Salt & Pepper -- StackEdge (then Prolab)
-- launched later (030) and never got equivalent triggers. This closes
-- that gap the exact same way: SECURITY DEFINER trigger functions
-- writing into the same shared table, no new schema. Mirrors 017's own
-- notify_new_application()/notify_application_status_change() almost
-- verbatim -- same shape, different underlying tables
-- (project_applications/project_asks instead of applications/jobs).
--
-- Deliberately NOT adding a notification for project upvotes or new
-- project updates -- lower-value and noisier than everything else here,
-- and nothing elsewhere on the platform notifies for a "like"-equivalent
-- either (FreeAgent doesn't notify sellers of profile views, GreyMatters
-- doesn't notify authors of post views).
--
-- Run this after 050_ai_sweep_observability.sql
-- ============================================================

-- ------------------------------------------------------------
-- New application to your ask
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_project_application()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_id UUID;
  v_role_title TEXT;
BEGIN
  SELECT project_asks.created_by, project_asks.role_title INTO v_owner_id, v_role_title
  FROM project_asks WHERE project_asks.id = NEW.ask_id;

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_owner_id, 'project_application_new', 'New application received',
            'Someone applied to "' || v_role_title || '"', '/asks/' || NEW.ask_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_project_application_created
  AFTER INSERT ON public.project_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_project_application();

-- ------------------------------------------------------------
-- Your application was accepted/declined
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_project_application_status_change()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role_title TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT project_asks.role_title INTO v_role_title FROM project_asks WHERE project_asks.id = NEW.ask_id;

    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (NEW.applicant_id, 'project_application_status', 'Application status updated',
            'Your application for "' || v_role_title || '" is now ' || NEW.status, '/asks/' || NEW.ask_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_project_application_status_updated
  AFTER UPDATE ON public.project_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_application_status_change();

-- ------------------------------------------------------------
-- Your submitted outcome was AI-scored, or human-reviewed
-- ------------------------------------------------------------
-- Fires on either transition independently (a row can get an AI score
-- first, then a human review later -- each is its own notification,
-- same "both are permanent, neither overwrites the other" philosophy
-- verified_outcomes' own columns already follow).
CREATE OR REPLACE FUNCTION public.notify_verified_outcome_scored()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link TEXT;
BEGIN
  v_link := CASE WHEN NEW.project_id IS NOT NULL THEN '/projects/' || NEW.project_id ELSE '/profile' END;

  IF NEW.ai_verified_at IS NOT NULL AND NEW.ai_verified_at IS DISTINCT FROM OLD.ai_verified_at THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (NEW.subject_user_id, 'verified_outcome_ai_scored', 'Your submission was AI-reviewed',
            'AI score: ' || COALESCE(NEW.ai_score::text, '—') || '/100', v_link);
  END IF;

  IF NEW.human_reviewed_at IS NOT NULL AND NEW.human_reviewed_at IS DISTINCT FROM OLD.human_reviewed_at THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (NEW.subject_user_id, 'verified_outcome_human_reviewed', 'Your submission was reviewed',
            'Status: ' || NEW.status || COALESCE(', score ' || NEW.human_score::text || '/100', ''), v_link);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_verified_outcome_scored
  AFTER UPDATE ON public.verified_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.notify_verified_outcome_scored();

-- ------------------------------------------------------------
-- An ask you applied to was closed
-- ------------------------------------------------------------
-- One notification per still-pending applicant -- an already-accepted/
-- declined applicant already got their own status-change notification
-- above and doesn't need a second one just because the ask also closed.
CREATE OR REPLACE FUNCTION public.notify_ask_closed()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT applicant_id, 'project_ask_closed', 'Ask closed',
           '"' || NEW.role_title || '" is no longer accepting applications', '/asks/' || NEW.id
    FROM project_applications
    WHERE ask_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_project_ask_closed
  AFTER UPDATE ON public.project_asks
  FOR EACH ROW EXECUTE FUNCTION public.notify_ask_closed();

NOTIFY pgrst, 'reload schema';
