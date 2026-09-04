-- ============================================================
-- Fix: marking a future role 'expired' never notified its
-- subscribers, only 'filled' did
-- ============================================================
--
-- Found while adding e2e coverage for FR-LL-05 ("A role's poster can
-- mark it filled or expired; every subscriber is notified when a role
-- they were interested in closes") -- the trigger 087 actually shipped,
-- notify_future_role_filled(), only ever checked
-- `NEW.status = 'filled'`, never 'expired', despite both being valid
-- values (see apps/longlist/src/app/api/future-roles/[id]/status/route.ts's
-- own VALID_STATUSES) and the feature's own stated intent covering
-- both. A subscriber to a role that quietly expired was never told at
-- all -- not a display bug, a genuinely missing notification.
--
-- Run this after 109_grandfather_job_post_credits.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_future_role_filled()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('filled', 'expired') AND OLD.status = 'open' THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT frs.user_id, 'future_role_filled', 'A role you were interested in has moved on',
           '"' || NEW.title || '" is no longer open on Longlist', '/roles'
    FROM future_role_subscriptions frs WHERE frs.future_role_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
