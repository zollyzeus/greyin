-- ============================================================
-- Cross-pillar collusion/fraud detection (Phase D1, "11 new AI
-- enhancements" plan)
-- ============================================================
--
-- peer_rater_reliability (090) and peer_project_reciprocity_flags (091)
-- already catch quid-pro-quo rating trades WITHIN StackWorks peer
-- projects. Neither can see a pair that trades favors ACROSS pillars --
-- e.g. A gives B a glowing FlexPro review, and B upvotes A's Salt &
-- Pepper project in return. That pattern is invisible to any single-
-- pillar check by construction, and is exactly the kind of gap a
-- platform with only one vertical's data could never even look for --
-- this is a genuinely new detection surface, not a copy of 090/091.
--
-- Deterministic SQL, no LLM call -- same "flag for human review, never
-- auto-restrict" posture as every other trust/safety view this session
-- (peer_rater_reliability, bias-audit). Admin-only (not employer): unlike
-- 090/091, which surface a legitimate hiring-diligence signal any
-- employer evaluating one candidate might want, a cross-pillar pattern
-- implicates BOTH people in a pair equally and isn't about evaluating
-- one candidate for one job -- platform integrity, not hiring diligence,
-- so it stays with the same audience as bias-audit/security findings.
--
-- "Favorable signal" per pillar, one row per real interaction:
--   - FlexPro: order_reviews, reviewer_id -> reviewee_id, rating >= 4
--   - Salt & Pepper: project_upvotes (voter) -> builder_projects.user_id
--     (project owner) -- upvoting is binary, so any upvote counts (no
--     rating scale to threshold)
--   - StackWorks: peer_project_ratings, rater_id -> ratee_id,
--     contribution_rating >= 4 (the same threshold 090/091 already use)
--
-- A flagged pair is two people where a favor exists in BOTH directions
-- on two DIFFERENT pillars -- same-pillar reciprocity is already 090/091's
-- job, deliberately excluded here (f1.pillar <> f2.pillar) to avoid
-- duplicating those findings under a different name.
-- ============================================================

CREATE OR REPLACE VIEW public.cross_pillar_reciprocity_flags AS
WITH favors AS (
  SELECT DISTINCT reviewer_id AS giver, reviewee_id AS receiver, 'flexpro'::text AS pillar
  FROM public.order_reviews
  WHERE rating >= 4 AND reviewer_id <> reviewee_id

  UNION

  SELECT DISTINCT pu.user_id AS giver, bp.user_id AS receiver, 'saltnpepper'::text AS pillar
  FROM public.project_upvotes pu
  JOIN public.builder_projects bp ON bp.id = pu.project_id
  WHERE pu.user_id <> bp.user_id

  UNION

  SELECT DISTINCT rater_id AS giver, ratee_id AS receiver, 'stackworks'::text AS pillar
  FROM public.peer_project_ratings
  WHERE contribution_rating >= 4 AND rater_id <> ratee_id
),
pairs AS (
  SELECT
    f1.giver AS person_a,
    f1.receiver AS person_b,
    f1.pillar AS a_to_b_pillar,
    f2.pillar AS b_to_a_pillar
  FROM favors f1
  JOIN favors f2
    ON f1.giver = f2.receiver AND f1.receiver = f2.giver AND f1.pillar <> f2.pillar
  -- Canonical direction only -- f1/f2 would otherwise also match with
  -- giver/receiver swapped, producing the identical real-world pair as a
  -- second mirror-image row.
  WHERE f1.giver < f1.receiver
)
SELECT
  person_a,
  pa.full_name AS person_a_name,
  person_b,
  pb.full_name AS person_b_name,
  array_agg(DISTINCT (a_to_b_pillar || ' -> ' || b_to_a_pillar)) AS cross_pillar_combos,
  count(*) AS mutual_favor_pair_count
FROM pairs
JOIN public.profiles pa ON pa.id = person_a
JOIN public.profiles pb ON pb.id = person_b
WHERE EXISTS (SELECT 1 FROM public.profiles v WHERE v.id = auth.uid() AND v.role = 'admin')
GROUP BY person_a, pa.full_name, person_b, pb.full_name;

GRANT SELECT ON public.cross_pillar_reciprocity_flags TO authenticated;

NOTIFY pgrst, 'reload schema';
