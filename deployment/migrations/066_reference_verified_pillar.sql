-- ============================================================
-- Denormalize the verified in-platform tie onto professional_references
-- ============================================================
--
-- collaborators (059) correctly restricts visibility to the two actual
-- participants -- an employer viewing a candidate's reference list is
-- neither, so a live query at read time would always return nothing for
-- them. Computed once at insert time instead, as the candidate (who
-- legitimately can see their own collaborators rows), and stored on the
-- row itself, which the employer already has a granted SELECT path to
-- (065's "Candidate, referee, and applicant-employers can view" policy).
--
-- Run this after 065_reference_checks.sql
-- ============================================================

ALTER TABLE public.professional_references ADD COLUMN verified_pillar TEXT;

CREATE OR REPLACE FUNCTION public.set_reference_verified_pillar()
RETURNS TRIGGER AS $$
BEGIN
  SELECT pillar INTO NEW.verified_pillar
  FROM collaborators
  WHERE user_id = NEW.candidate_id AND collaborator_id = NEW.reference_user_id
  ORDER BY occurred_at DESC
  LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER professional_references_set_verified_pillar
  BEFORE INSERT ON public.professional_references
  FOR EACH ROW EXECUTE FUNCTION public.set_reference_verified_pillar();

NOTIFY pgrst, 'reload schema';
