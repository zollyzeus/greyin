-- ============================================================
-- Fix: ask/project owners couldn't see a pending verified_outcome
-- ============================================================
--
-- 031's SELECT policy on verified_outcomes only covers the subject
-- themselves or already-`verified` rows ("Subjects can view their own
-- outcomes; everyone can view verified ones"). That silently blocked the
-- one reader who actually needs to see a *pending* submission: the ask
-- owner reviewing it. Caught by verification.spec.ts against prod -- the
-- Supporter's own page correctly showed their submission, but the
-- Builder's page showed "Waiting for their work to be submitted" even
-- after it was, because their SELECT returned zero rows under RLS.
--
-- Same additive-policy approach as 031: PERMISSIVE policies for the same
-- command combine with OR, so this only adds a reader, it doesn't touch
-- 031's existing policy.
--
-- Run this after 031_verification_engine.sql
-- ============================================================

CREATE POLICY "Ask and project owners can view outcomes on their asks/projects"
  ON public.verified_outcomes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_applications pa
      JOIN public.project_asks pk ON pk.id = pa.ask_id
      WHERE pa.id = verified_outcomes.application_id AND pk.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.builder_projects bp
      WHERE bp.id = verified_outcomes.project_id AND bp.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
