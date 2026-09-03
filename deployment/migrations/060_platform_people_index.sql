-- ============================================================
-- platform_people_index: a person-level search dimension, distinct
-- from platform_search_index (037), which is content-only (posts/
-- jobs/gigs/discussions/projects). Natural-language ecosystem search
-- needs to be able to answer "senior React freelancers with 4+
-- verified outcomes" -- a question about PEOPLE, which the existing
-- content index has no way to represent.
-- ============================================================
--
-- Aggregates profiles/candidates/greyin_scores/verified_outcomes/
-- profile_skills. Same unfiltered-view convention as every other
-- cross-cutting view this session -- security comes from the
-- underlying tables' own RLS (profiles/candidates are broadly
-- readable by any authenticated user already; greyin_scores and
-- profile_skills are both already public-readable views/tables).
--
-- Run this after 059_collaborators.sql
-- ============================================================

CREATE OR REPLACE VIEW public.platform_people_index AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.location,
  gs.greyin_score,
  COALESCE(gs.is_verified_expert, false) AS is_verified_expert,
  COALESCE(vo.verified_outcomes_count, 0) AS verified_outcomes_count,
  COALESCE(ps.skills, ARRAY[]::text[]) AS skills,
  c.availability,
  c.current_title,
  p.is_mentor,
  p.mentor_domain
FROM public.profiles p
LEFT JOIN public.greyin_scores gs ON gs.user_id = p.id
LEFT JOIN public.candidates c ON c.user_id = p.id
LEFT JOIN (
  SELECT subject_user_id, COUNT(*) AS verified_outcomes_count
  FROM public.verified_outcomes
  WHERE status = 'verified'
  GROUP BY subject_user_id
) vo ON vo.subject_user_id = p.id
LEFT JOIN (
  SELECT user_id, array_agg(skill ORDER BY skill) AS skills
  FROM public.profile_skills
  GROUP BY user_id
) ps ON ps.user_id = p.id;

GRANT SELECT ON public.platform_people_index TO authenticated;

NOTIFY pgrst, 'reload schema';
