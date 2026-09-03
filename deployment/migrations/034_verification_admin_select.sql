-- ============================================================
-- Fix: admins couldn't see pending verified_outcomes they don't own
-- ============================================================
--
-- 030 gave admins INSERT/UPDATE on verified_outcomes but never a
-- matching SELECT policy -- harmless while nothing exercised the admin
-- "Verifications" panel against an outcome the admin isn't the
-- ask/project owner of, which is exactly the project_shipped
-- self-submission path (033) where admin is the ONLY reviewer. Caught
-- by project-shipped.spec.ts against prod: the admin page showed "No
-- verifications pending review" for a real pending row because the
-- SELECT simply returned zero rows under RLS.
--
-- Run this after 033_verification_self_review_and_shipped.sql
-- ============================================================

CREATE POLICY "Admins can view all verified outcomes"
  ON public.verified_outcomes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

NOTIFY pgrst, 'reload schema';
