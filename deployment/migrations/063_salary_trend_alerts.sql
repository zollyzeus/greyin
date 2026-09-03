-- ============================================================
-- Salary trend alerts: opt-in watches on a (role, level, location)
-- combination, with a lazy sweep that notifies on a material move
-- ============================================================
--
-- Addresses the competitive audit's retention-lever recommendation:
-- a low-effort return trigger tied to the salary_trends feature (055)
-- already shipped, matching the "lazy, page-load-triggered" convention
-- used throughout this codebase (finalize_expired_verified_outcomes,
-- finalize_completed_mentor_sessions) rather than pg_cron.
--
-- Run this after 062_mentor_monetization.sql
-- ============================================================

CREATE TABLE public.salary_trend_watches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  level TEXT,
  location TEXT,
  last_seen_mid NUMERIC,
  last_alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_title, level, location)
);

CREATE INDEX idx_salary_trend_watches_user ON public.salary_trend_watches(user_id);

ALTER TABLE public.salary_trend_watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own salary trend watches"
  ON public.salary_trend_watches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- sweep_salary_trend_alerts(): compares each of the CALLING user's
-- watches against the latest salary_trends row for that combination
-- (most recent period, any source) and notifies on a >=15% move
-- since last seen. Scoped to auth.uid() rather than all users --
-- invoked from a page load, same "do this user's overdue work while
-- they're here" shape as finalize_completed_mentor_sessions.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_salary_trend_alerts()
RETURNS void
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_watch RECORD;
  v_latest RECORD;
  v_mid NUMERIC;
  v_pct_change NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  FOR v_watch IN
    SELECT * FROM public.salary_trend_watches WHERE user_id = auth.uid()
  LOOP
    SELECT (avg_salary_low + avg_salary_high) / 2.0 AS mid
    INTO v_latest
    FROM public.salary_trends
    WHERE role_title = v_watch.role_title
      AND level IS NOT DISTINCT FROM v_watch.level
      AND location IS NOT DISTINCT FROM v_watch.location
    ORDER BY period DESC
    LIMIT 1;

    IF v_latest IS NULL THEN
      CONTINUE;
    END IF;

    v_mid := v_latest.mid;

    IF v_watch.last_seen_mid IS NOT NULL AND v_watch.last_seen_mid > 0 THEN
      v_pct_change := ABS(v_mid - v_watch.last_seen_mid) / v_watch.last_seen_mid;
      IF v_pct_change >= 0.15 THEN
        INSERT INTO public.notifications (user_id, type, title, body, link)
        VALUES (
          auth.uid(), 'salary_trend_moved', 'A tracked salary range moved',
          v_watch.role_title || COALESCE(' (' || v_watch.level || ')', '') ||
            ' moved ' || CASE WHEN v_mid > v_watch.last_seen_mid THEN 'up' ELSE 'down' END ||
            ' ' || ROUND(v_pct_change * 100) || '% since you last checked',
          '/salary-trends'
        );
        UPDATE public.salary_trend_watches SET last_alerted_at = now() WHERE id = v_watch.id;
      END IF;
    END IF;

    UPDATE public.salary_trend_watches SET last_seen_mid = v_mid WHERE id = v_watch.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.sweep_salary_trend_alerts() TO authenticated;

NOTIFY pgrst, 'reload schema';
