-- ============================================================
-- Fix: platform_people_index lost future_interests/future_interests_note
-- entirely, silently breaking Longlist's AI candidate matching since
-- the internal-rename migrations
-- ============================================================
--
-- Found while adding e2e coverage for FR-LL-04 (AI-surfaced second
-- candidate set) at direct user request. The feature genuinely never
-- worked, for anyone, ever, since it shipped -- not a timeout or a
-- model-quality issue, a real query error swallowed by
-- match-candidates.ts's own deliberate "never throws" design:
-- 087_longlist_future_roles.sql correctly added future_interests and
-- future_interests_note to this view, but 103_flexpro_rename.sql
-- (renaming a pillar-score column elsewhere in the same view) redefined
-- the whole view from a stale, pre-087 base copy that never had those
-- two columns, silently dropping them via CREATE OR REPLACE VIEW.
-- 105_stackworks_rename.sql then explicitly says "103's exact body,
-- unchanged" and carried the same regression forward again. A
-- PostgREST query selecting a column the view doesn't have errors
-- entirely (not just that column) -- so
-- apps/longlist/src/lib/match-candidates.ts's own `people` destructure
-- came back null on every single call, hitting the
-- `if (!people || people.length === 0) return []` early return before
-- ever reaching the LLM. The empty-list UI state ("this needs an admin
-- to enable matching, or no profile currently fits") reads identically
-- whether the feature is genuinely off, no provider is configured, the
-- LLM call fails, or -- this whole time -- the underlying query itself
-- was broken, which is exactly why this went unnoticed.
--
-- Restores the view to 103/105's current full column set plus the two
-- 087 columns, nothing else changed.
--
-- Run this after 110_fix_future_role_expired_notification.sql
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
  p.mentor_domain,
  p.future_interests,
  p.future_interests_note
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
