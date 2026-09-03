-- ============================================================
-- Close a self-review hole ahead of enabling project_shipped submissions
-- ============================================================
--
-- 031's owner-review UPDATE policy lets a project/ask owner review any
-- outcome tied to their project -- fine when the subject is someone
-- else (a Supporter completing an ask), but about to become a real
-- trust hole once Builders can self-submit a `project_shipped` outcome
-- for their own project (application_id NULL, project_id = their own):
-- the same policy would let them rubber-stamp their own submission.
-- Narrowed to exclude the subject reviewing themselves -- admin is the
-- reviewer for self-submitted outcomes (the existing admin UPDATE
-- policy from 030 is untouched and still applies).
--
-- Run this after 032_verification_owner_select.sql
-- ============================================================

DROP POLICY "Ask and project owners can add their human review" ON public.verified_outcomes;

CREATE POLICY "Ask and project owners can add their human review"
  ON public.verified_outcomes FOR UPDATE
  USING (
    auth.uid() != subject_user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.project_applications pa
        JOIN public.project_asks pk ON pk.id = pa.ask_id
        WHERE pa.id = verified_outcomes.application_id AND pk.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.builder_projects bp
        WHERE bp.id = verified_outcomes.project_id AND bp.user_id = auth.uid()
      )
    )
  );

NOTIFY pgrst, 'reload schema';
