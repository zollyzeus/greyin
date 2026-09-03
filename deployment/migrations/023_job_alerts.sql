-- ============================================================
-- Job alerts / saved searches (Greyin)
-- ============================================================
--
-- Scoped to keyword + location matching only, not the full filter matrix
-- on /jobs (employment type, experience level, category checkboxes) — those
-- were already decorative/unwired before this migration and wiring the
-- full set is a larger, separate piece of work. This covers the actual
-- "notify me about new jobs matching X" use case.
--
-- No pg_cron in this deployment, so alerts fire via a trigger on new job
-- inserts rather than a scheduled digest — each alert owner gets a
-- notification (existing notifications infra) the moment a matching job
-- goes live, which is arguably better than a delayed batch anyway.
-- ============================================================

CREATE TABLE public.job_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keywords TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_alerts_user_id ON public.job_alerts(user_id);

ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own job alerts"
  ON public.job_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own job alerts"
  ON public.job_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own job alerts"
  ON public.job_alerts FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_matching_job_alerts()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_alert RECORD;
BEGIN
  IF NEW.status != 'open' THEN
    RETURN NEW;
  END IF;

  FOR v_alert IN
    SELECT * FROM job_alerts
    WHERE (keywords IS NULL OR keywords = '' OR NEW.title ILIKE '%' || keywords || '%' OR NEW.description ILIKE '%' || keywords || '%')
      AND (location IS NULL OR location = '' OR NEW.location ILIKE '%' || location || '%')
  LOOP
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_alert.user_id, 'job_alert', 'New job matching your alert', NEW.title, '/jobs/' || NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_job_posted_check_alerts
  AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_matching_job_alerts();

NOTIFY pgrst, 'reload schema';