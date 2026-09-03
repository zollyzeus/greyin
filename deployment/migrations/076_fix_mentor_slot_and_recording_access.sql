-- ============================================================
-- SEC-023 (2026-08-26 security audit): two real gaps in
-- mentor_session_slots found together.
--
-- (1) The WITH CHECK on "Mentors can attach a recording to their own
-- slots" (062) only requires auth.uid() = mentor_id -- nothing stops
-- the mentor changing status or gig_order_id through that same policy.
-- Since Postgres combines multiple permissive UPDATE policies on the
-- same table with OR at both the USING and WITH CHECK level, a mentor
-- can PATCH a 'booked' slot (allowed in by 062's USING, which lists
-- 'booked' as well as 'open') and set status back to 'open' + null out
-- gig_order_id -- 062's WITH CHECK doesn't block it even though 056's
-- own "update their own open slots" policy would have (it only matches
-- status='open' rows to begin with, so it never even applies to a
-- booked row). Net effect: a mentor can resell an already-paid seat.
--
-- (2) The SELECT policy exposes every column, including recording_url,
-- on any 'open' slot to anyone, and 062 never restricted it further --
-- so a direct PostgREST read (bypassing the app's own UI, which does
-- gate the rendered link correctly) gets the real recording URL without
-- ever calling purchase_recording_access().
--
-- Run this after 075_auth_rate_limiting.sql
-- ============================================================

-- ------------------------------------------------------------
-- (1) Trigger-based guard, same pattern as enforce_gig_order_transition
-- (073) and enforce_profile_role_immutable (070/067) -- RLS policies
-- alone can't express "this column may only change via the trusted
-- server-side function," a BEFORE UPDATE trigger can.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_mentor_slot_update()
RETURNS TRIGGER AS $$
BEGIN
  -- book_mentor_slot() (056) and any future admin/dispute path run
  -- SECURITY DEFINER, which changes current_user to the function owner
  -- (postgres) for the duration -- same exemption shape as every other
  -- trusted-caller check in this codebase (070, 073, 074).
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.mentor_id IS DISTINCT FROM OLD.mentor_id
    OR NEW.gig_id IS DISTINCT FROM OLD.gig_id
    OR NEW.gig_order_id IS DISTINCT FROM OLD.gig_order_id THEN
    RAISE EXCEPTION 'mentor_id, gig_id, and gig_order_id can never be changed by a direct client update';
  END IF;

  IF OLD.status = 'booked' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'A booked slot can only change status via the platform''s own booking/cancellation flow, not a direct update';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_mentor_slot_update ON public.mentor_session_slots;
CREATE TRIGGER trg_enforce_mentor_slot_update
  BEFORE UPDATE ON public.mentor_session_slots
  FOR EACH ROW EXECUTE FUNCTION public.enforce_mentor_slot_update();

-- ------------------------------------------------------------
-- (2) recording_url exposure -- column-level REVOKE (same idiom as
-- SEC-020's company_reviews.reviewer_id fix, 067/072) plus a SECURITY
-- DEFINER RPC for the one legitimate read path: the mentor themselves,
-- the slot's original booking buyer, or a genuine recording purchaser.
-- recording_price stays publicly readable -- it's not the sensitive
-- part, and both existing pages need to show it to render a working
-- "Buy access" button.
-- ------------------------------------------------------------
REVOKE SELECT (recording_url) ON public.mentor_session_slots FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_visible_recording_urls(p_slot_ids UUID[])
RETURNS TABLE(slot_id UUID, recording_url TEXT)
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.id, s.recording_url
  FROM public.mentor_session_slots s
  WHERE s.id = ANY(p_slot_ids)
    AND s.recording_url IS NOT NULL
    AND (
      s.mentor_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.mentor_recording_purchases p WHERE p.slot_id = s.id AND p.buyer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.gig_orders go WHERE go.id = s.gig_order_id AND go.buyer_id = auth.uid())
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_visible_recording_urls(UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
