-- ============================================================
-- Widen rate_limit_attempts.action to cover the new demo-login route
-- ============================================================
--
-- 075's rate_limit_attempts.action CHECK only allows 'password_reset'
-- and 'signup'. The new public, unauthenticated /api/demo-login route
-- (Greyin Hub) reuses the exact same check_rate_limit/
-- record_rate_limit_attempt mechanism -- a checked-in "Launch Demo"
-- button is a real anonymous-abuse surface (a scripted client could
-- otherwise hammer signInWithPassword directly) -- so it needs its own
-- action value, not a new table.
--
-- Run this after 136_jobs_applications_count_trigger.sql
-- ============================================================

ALTER TABLE public.rate_limit_attempts DROP CONSTRAINT rate_limit_attempts_action_check;
ALTER TABLE public.rate_limit_attempts ADD CONSTRAINT rate_limit_attempts_action_check
  CHECK (action = ANY (ARRAY['password_reset', 'signup', 'demo_login']));
