-- 021_direct_messaging.sql's "Participants can view conversation membership"
-- policy on conversation_participants queries conversation_participants from
-- within its own USING clause. Postgres re-applies RLS to that inner
-- reference too, which re-triggers the same policy, which queries the table
-- again, and so on — Postgres detects this and raises "infinite recursion
-- detected in policy for relation conversation_participants" for every
-- SELECT, including the ones nested inside the sibling policy on
-- conversations ("Participants can view their conversations"), which relies
-- on being able to read conversation_participants to determine membership.
-- End-to-end effect: /messages/[id]'s participants query silently errors,
-- comes back empty, and the page 404s via notFound() even though the
-- conversation and both participant rows exist correctly.
--
-- Fix: move the membership check into a SECURITY DEFINER function. Owned by
-- postgres (BYPASSRLS), its internal SELECT does not re-invoke RLS, so the
-- recursion is broken.

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id
  );
$$;

DROP POLICY IF EXISTS "Participants can view conversation membership" ON conversation_participants;
CREATE POLICY "Participants can view conversation membership" ON conversation_participants
  FOR SELECT USING (is_conversation_participant(conversation_id, auth.uid()));
