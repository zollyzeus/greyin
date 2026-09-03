-- ============================================================
-- SEC-032 (2026-08-26 security audit): the "informal chat" branch of
-- StackEdge's initial skill-rating gate (054) only required a single
-- direct_messages row to exist in a shared conversation between rater
-- and ratee -- satisfiable by the rater sending one throwaway DM the
-- ratee never even has to reply to, then immediately posting a public
-- 1-star rating against them. The migration's own intent (an early,
-- informal rating right after a real "quick technical assessment"
-- chat) implies an actual two-way exchange, not a monologue.
--
-- Fixed by requiring messages from BOTH participants in the shared
-- conversation, not just any single message's existence -- a real
-- back-and-forth, still cheap/lightweight (no minimum message count or
-- length), just no longer satisfiable by a one-sided drive-by DM.
--
-- Run this after 082_fix_unread_message_count_authz.sql
-- ============================================================

DROP POLICY IF EXISTS "StackEdge collaborators can give an initial skill rating" ON public.skill_ratings;

CREATE POLICY "StackEdge collaborators can give an initial skill rating"
  ON public.skill_ratings FOR INSERT
  WITH CHECK (
    project_application_id IS NOT NULL
    AND auth.uid() = rater_id
    AND stage = 'initial'
    AND EXISTS (
      SELECT 1 FROM public.project_applications pa
      JOIN public.project_asks ask ON ask.id = pa.ask_id
      WHERE pa.id = skill_ratings.project_application_id
        AND skill_ratings.skill = ANY(ask.skills)
        AND (
          (ask.created_by = auth.uid() AND pa.applicant_id = skill_ratings.ratee_id) OR
          (pa.applicant_id = auth.uid() AND ask.created_by = skill_ratings.ratee_id)
        )
        AND (
          (ask.status = 'closed' AND pa.status = 'accepted')
          OR EXISTS (
            SELECT 1 FROM public.conversation_participants cp1
            JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
            WHERE cp1.user_id = auth.uid() AND cp2.user_id = skill_ratings.ratee_id
              AND EXISTS (
                SELECT 1 FROM public.direct_messages dm1
                WHERE dm1.conversation_id = cp1.conversation_id AND dm1.sender_id = auth.uid()
              )
              AND EXISTS (
                SELECT 1 FROM public.direct_messages dm2
                WHERE dm2.conversation_id = cp1.conversation_id AND dm2.sender_id = skill_ratings.ratee_id
              )
          )
        )
    )
  );

NOTIFY pgrst, 'reload schema';
