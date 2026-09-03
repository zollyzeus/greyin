-- ============================================================
-- SEC-030 (2026-08-26 security audit): get_unread_message_count (005)
-- is SECURITY DEFINER with PUBLIC EXECUTE (confirmed via pg_proc.proacl
-- -- the "=X" entry) and no authorization check at all -- any caller,
-- including anon, could pass an arbitrary p_order_id/p_user_id pair.
-- Two real leaks: (1) nothing stopped p_user_id from being someone
-- else's id, letting a caller read another user's unread count, and
-- (2) even with p_user_id pinned to the caller, SECURITY DEFINER
-- bypasses order_messages' own RLS, so a caller who isn't a real
-- participant in p_order_id at all still got a real message count for
-- that order (every message not "from" them, i.e. every message,
-- since they never sent one there) -- a count-only leak of private
-- order conversations they have no relation to.
--
-- Fixed by requiring auth.uid() = p_user_id and requiring the caller
-- actually be the buyer or seller on that order (0 for anyone else,
-- not an error, matching this function's original "just a count"
-- contract), plus REVOKE/GRANT to close the PUBLIC/anon execute grant.
--
-- Run this after 081_fix_newsletter_enumeration.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_unread_message_count(p_order_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.gig_orders
    WHERE id = p_order_id AND (buyer_id = p_user_id OR seller_id = p_user_id)
  ) THEN
    RETURN 0;
  END IF;

  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.order_messages
    WHERE order_id = p_order_id
      AND sender_id != p_user_id
      AND read_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.get_unread_message_count(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_message_count(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
