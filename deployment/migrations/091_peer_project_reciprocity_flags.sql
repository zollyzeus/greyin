-- ============================================================
-- Per-project reciprocal-rating flags (employer/admin-only)
-- ============================================================
--
-- peer_rater_reliability (090) answers "does this person, in
-- aggregate, tend to trade high ratings back and forth" -- useful,
-- but doesn't say WHICH of a candidate's peer-confirmed projects that
-- pattern actually shows up on. An employer reading a specific
-- project on a candidate's profile needs to know if THAT one is part
-- of a mutual-high-rating pair, not just a platform-wide percentage.
--
-- One row per (project, the two people in the mutual pair) where both
-- sides rated each other >=4 on that same project. Same "gate baked
-- into the view's own WHERE clause" approach as 090's
-- peer_rater_reliability, for the same reason: peer_project_ratings'
-- own SELECT policy no longer broadly exposes individual rows, so
-- this view's exposure has to be independently gated.
--
-- Run this after 090_peer_rating_anonymity_and_rater_reliability.sql
-- ============================================================

CREATE OR REPLACE VIEW public.peer_project_reciprocity_flags AS
SELECT DISTINCT
  g1.project_id,
  g1.rater_id AS person_a,
  g1.ratee_id AS person_b,
  g1.contribution_rating AS a_gave_b,
  g2.contribution_rating AS b_gave_a
FROM public.peer_project_ratings g1
JOIN public.peer_project_ratings g2
  ON g1.project_id = g2.project_id
  AND g1.rater_id = g2.ratee_id
  AND g1.ratee_id = g2.rater_id
  -- g1.rater_id < g2.rater_id de-dupes the pair to one row instead of
  -- two mirror-image rows (A->B alongside B->A of the same pair).
  AND g1.rater_id < g2.rater_id
WHERE g1.contribution_rating >= 4
  AND g2.contribution_rating >= 4
  AND EXISTS (SELECT 1 FROM public.profiles v WHERE v.id = auth.uid() AND v.role IN ('employer', 'admin'));

GRANT SELECT ON public.peer_project_reciprocity_flags TO authenticated;

NOTIFY pgrst, 'reload schema';
