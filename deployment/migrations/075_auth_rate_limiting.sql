-- ============================================================
-- DB-backed rate limiting for password reset (SEC-015) and signup (SEC-017)
-- ============================================================
--
-- Neither GoTrue's own defaults nor anything in this codebase currently
-- limit *guessing* a 6-digit recovery OTP (only *sending* the reset
-- email is rate-limited, GOTRUE_RATE_LIMIT_EMAIL_SENT) or *attempting*
-- signups. A single shared attempts table serves both, since the shape
-- is identical -- count recent failures/attempts for a key within a
-- window, block once a threshold is crossed. No direct grants to
-- anon/authenticated on the table itself -- every read/write goes
-- through the two SECURITY DEFINER RPCs below, so a client can't insert
-- fake "success" rows to erase their own lockout.
--
-- Full signup captcha (GOTRUE_SECURITY_CAPTCHA_*) needs a third-party
-- provider decision from the user (hCaptcha/Turnstile/etc, a real
-- external dependency + secret this session doesn't have and shouldn't
-- pick unilaterally) -- this migration only adds the DB-backed rate
-- limit, which meaningfully raises the bar without that decision.
--
-- Run this after 074_fix_reputation_trigger_execute.sql
-- ============================================================

CREATE TABLE public.rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL CHECK (action IN ('password_reset', 'signup')),
  key TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_attempts_lookup ON public.rate_limit_attempts(action, key, created_at);

ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;
-- No policies at all -- anon/authenticated get zero direct access;
-- only the SECURITY DEFINER functions below (owned by postgres) can
-- read or write this table.

-- Periodic cleanup, same lazy/page-load-triggered pattern as
-- finalize_expired_verified_outcomes() (031) rather than pg_cron (not
-- available in this deployment) -- called opportunistically from
-- inside the two check functions below, self-limiting since it only
-- ever deletes rows already well outside any real lockout window.
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limit_attempts()
RETURNS VOID AS $$
BEGIN
  DELETE FROM rate_limit_attempts WHERE created_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- p_max_failures/p_window_minutes let each call site tune its own
-- threshold (password reset and signup don't need identical limits)
-- without needing a second near-duplicate function.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action TEXT, p_key TEXT, p_max_failures INTEGER, p_window_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_recent_failures INTEGER;
BEGIN
  PERFORM cleanup_old_rate_limit_attempts();

  SELECT count(*) INTO v_recent_failures
  FROM rate_limit_attempts
  WHERE action = p_action
    AND key = lower(p_key)
    AND success = false
    AND created_at > now() - make_interval(mins => p_window_minutes);

  RETURN v_recent_failures < p_max_failures;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_rate_limit_attempt(p_action TEXT, p_key TEXT, p_success BOOLEAN)
RETURNS VOID AS $$
BEGIN
  INSERT INTO rate_limit_attempts (action, key, success) VALUES (p_action, lower(p_key), p_success);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Both password reset and signup happen before a session exists, so the
-- calling role is anon, not authenticated.
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_rate_limit_attempt(TEXT, TEXT, BOOLEAN) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
