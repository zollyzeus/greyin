-- ============================================================
-- SEC-024 (2026-08-26 security audit): create_job_referral_notification
-- (040) is SECURITY DEFINER and GRANTed to authenticated -- so while the
-- one real caller (apps/greyin-b2b/src/app/api/jobs/[id]/refer/route.ts)
-- already derives p_referrer_name and p_job_title server-side from real
-- data, nothing stops a direct RPC call (bypassing that route entirely)
-- from passing completely attacker-controlled text for both, and an
-- arbitrary p_job_id that was never checked to actually exist. The only
-- previously-enforced constraint was auth.uid() IS NOT NULL (any logged
-- -in user) and notifications.user_id's FK (blocks a nonexistent
-- recipient, but not an arbitrary real one).
--
-- Fixed by dropping the client-supplied referrer_name/job_title
-- parameters entirely and deriving both from real rows the function
-- looks up itself -- a caller can no longer put arbitrary text in
-- another user's notification inbox through this path, only their own
-- real name and a real job's real title.
--
-- Run this after 076_fix_mentor_slot_and_recording_access.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_job_referral_notification(
  p_recipient_id UUID,
  p_job_id UUID
)
RETURNS VOID
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referrer_name TEXT;
  v_job_title TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(full_name, email, 'A Greyin member') INTO v_referrer_name
  FROM public.profiles WHERE id = auth.uid();

  SELECT title INTO v_job_title FROM public.jobs WHERE id = p_job_id;
  IF v_job_title IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    p_recipient_id,
    'job_referral',
    v_referrer_name || ' referred you to a job',
    v_job_title,
    '/jobs/' || p_job_id
  );
END;
$$ LANGUAGE plpgsql;

-- Old 4-arg signature is no longer callable by anyone once this
-- REVOKE/new-signature pair lands -- PostgREST dispatches by exact
-- argument-name match, so a stale client couldn't accidentally still
-- hit the vulnerable version.
REVOKE ALL ON FUNCTION public.create_job_referral_notification(UUID, UUID, TEXT, TEXT) FROM PUBLIC, authenticated;
DROP FUNCTION IF EXISTS public.create_job_referral_notification(UUID, UUID, TEXT, TEXT);

GRANT EXECUTE ON FUNCTION public.create_job_referral_notification(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
