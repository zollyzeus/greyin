-- ============================================================
-- Peer Referral Bridge: notify an existing member they were referred
-- ============================================================
--
-- notifications has RLS enabled with no INSERT policy at all -- every
-- existing writer is a SECURITY DEFINER trigger (notify_new_application,
-- notify_new_direct_message in earlier migrations), since a plain
-- user-scoped INSERT policy letting anyone write a notification "to"
-- an arbitrary user_id would be a spam/spoofing vector. This follows
-- the same pattern as an RPC rather than a trigger (there's no natural
-- table event to hang a trigger off of here), mirroring
-- ensure_pillar_membership's shape: SECURITY DEFINER, checks auth.uid(),
-- called directly from the referral route.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_job_referral_notification(
  p_recipient_id UUID,
  p_job_id UUID,
  p_job_title TEXT,
  p_referrer_name TEXT
)
RETURNS VOID
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    p_recipient_id,
    'job_referral',
    p_referrer_name || ' referred you to a job',
    p_job_title,
    '/jobs/' || p_job_id
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.create_job_referral_notification(UUID, UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
