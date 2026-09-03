-- ============================================================
-- SEC-029 (2026-08-26 security audit): newsletter_subscribers' INSERT
-- policy (WITH CHECK (true), 008) lets anon insert directly via
-- PostgREST -- the app's own route already treats a 23505 (duplicate
-- email) response the same as a fresh signup, but that's only a UI-
-- layer courtesy. A direct call to /rest/v1/newsletter_subscribers
-- (bypassing the app route entirely) still gets a genuinely different
-- response for an already-subscribed email (409/23505) vs a new one
-- (201) -- a real email-enumeration oracle at the API level, RLS can't
-- suppress a UNIQUE constraint violation.
--
-- Fixed by moving the insert behind a SECURITY DEFINER RPC that
-- swallows the conflict internally (ON CONFLICT DO NOTHING) and always
-- returns the same thing regardless of whether the email was new or
-- already subscribed, then revoking the direct table INSERT grant so
-- the raw enumerable endpoint isn't reachable at all anymore.
--
-- Run this after 080_fix_activity_feed_view_audience.sql
-- ============================================================

REVOKE INSERT ON public.newsletter_subscribers FROM anon, authenticated;
DROP POLICY IF EXISTS "Anyone can subscribe to the newsletter" ON public.newsletter_subscribers;

CREATE OR REPLACE FUNCTION public.subscribe_to_newsletter(p_email TEXT)
RETURNS VOID
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.newsletter_subscribers (email)
  VALUES (lower(trim(p_email)))
  ON CONFLICT (email) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.subscribe_to_newsletter(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
