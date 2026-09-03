-- ============================================================
-- Ethos audit fixes (2026-08-23): gate skill endorsements and Salt &
-- Pepper karma behind a real, verified interaction, matching how every
-- other trust signal on the platform already works (skill ratings,
-- recommendations, company reviews, worked-together discovery).
-- ============================================================
--
-- Run this after 063_salary_trend_alerts.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Skill endorsements: was the one open, unverified social-proof
-- signal on the platform -- any authenticated user could endorse
-- anyone's skill with zero interaction requirement, the same
-- structural pattern the competitive audit criticized in LinkedIn's
-- endorsements. Gated to the same "worked together" evidence
-- (collaborators, 059) already used elsewhere: a real accepted
-- StackEdge collaboration or a real completed FreeAgent order.
-- ------------------------------------------------------------
DROP POLICY "Any authenticated user can endorse a real skill" ON public.skill_endorsements;

CREATE POLICY "Only real collaborators can endorse a skill"
  ON public.skill_endorsements FOR INSERT
  WITH CHECK (
    auth.uid() = endorser_id
    AND endorser_id <> endorsee_id
    AND EXISTS (
      SELECT 1 FROM public.profile_skills
      WHERE profile_skills.user_id = skill_endorsements.endorsee_id AND profile_skills.skill = skill_endorsements.skill
    )
    AND EXISTS (
      SELECT 1 FROM public.collaborators
      WHERE collaborators.user_id = auth.uid() AND collaborators.collaborator_id = skill_endorsements.endorsee_id
    )
  );

-- ------------------------------------------------------------
-- 2. Greyin Score's saltnpepper_evidence: reputation_events (025)
-- awards points for THREE self-generated actions (discussion_created,
-- reply_given, project_created -- a user posting content about
-- themselves, no one else involved) and only ONE other-person-verified
-- action (project_upvoted, real per-user-deduped upvotes from someone
-- else). Bayesian shrinkage's headcount-weighting makes unfiltered
-- self-generated points actively dangerous, not just noisy: more posts
-- (self-generated headcount) shrinks the confidence penalty and makes
-- an inflated score look MORE trustworthy, the opposite of what
-- shrinkage is supposed to do.
--
-- reputation_scores (Salt & Pepper's own /members display) is left
-- untouched -- posting activity is legitimate community standing
-- there, just not evidence for a hiring-relevant composite score.
-- Only the Greyin Score's own aggregation is narrowed to the
-- verified-interaction subset.
--
-- Rebuilt from 048_ai_quality_scores.sql's version (the actual current
-- definition -- 041's original 3-input version is stale; GreyMatters
-- became a 4th input in 048). CREATE OR REPLACE, not DROP+CREATE,
-- since the column set is unchanged this time -- only the
-- saltnpepper_raw CTE's WHERE clause is new.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.greyin_scores AS
WITH constants AS (
  SELECT 3 AS m_stackedge, 5 AS m_freeagent, 10 AS m_saltnpepper, 5 AS m_greymatters
),
stackedge_raw AS (
  SELECT subject_user_id AS user_id, AVG(score)::numeric AS raw, COUNT(*) AS v
  FROM public.verified_outcomes
  WHERE status = 'verified'
  GROUP BY subject_user_id
),
freeagent_raw AS (
  SELECT id AS user_id, (seller_rating / 5.0 * 100)::numeric AS raw, total_reviews AS v
  FROM public.profiles
  WHERE total_reviews > 0
),
saltnpepper_raw AS (
  SELECT user_id, (LEAST(SUM(points), 100)::numeric / 100 * 100) AS raw, COUNT(*) AS v
  FROM public.reputation_events
  WHERE event_type = 'project_upvoted'
  GROUP BY user_id
),
greymatters_raw AS (
  SELECT subject_user_id AS user_id, AVG(score)::numeric AS raw, COUNT(*) AS v
  FROM public.ai_quality_scores
  WHERE content_type = 'greymatters_post'
  GROUP BY subject_user_id
),
platform_stats AS (
  SELECT
    (SELECT AVG(raw) FROM stackedge_raw) AS stackedge_mean,
    (SELECT COUNT(*) FROM stackedge_raw) AS stackedge_headcount,
    (SELECT AVG(raw) FROM freeagent_raw) AS freeagent_mean,
    (SELECT COUNT(*) FROM freeagent_raw) AS freeagent_headcount,
    (SELECT AVG(raw) FROM saltnpepper_raw) AS saltnpepper_mean,
    (SELECT COUNT(*) FROM saltnpepper_raw) AS saltnpepper_headcount,
    (SELECT AVG(raw) FROM greymatters_raw) AS greymatters_mean,
    (SELECT COUNT(*) FROM greymatters_raw) AS greymatters_headcount
),
per_user AS (
  SELECT
    p.id AS user_id,
    p.years_experience,
    pr.v AS stackedge_evidence,
    pr.raw AS stackedge_raw,
    CASE WHEN pr.v IS NOT NULL THEN
      ROUND((pr.v::numeric / (pr.v + c.m_stackedge)) * pr.raw + (c.m_stackedge::numeric / (pr.v + c.m_stackedge)) * s.stackedge_mean)
    END AS stackedge_score,
    fa.v AS freeagent_evidence,
    fa.raw AS freeagent_raw,
    CASE WHEN fa.v IS NOT NULL THEN
      ROUND((fa.v::numeric / (fa.v + c.m_freeagent)) * fa.raw + (c.m_freeagent::numeric / (fa.v + c.m_freeagent)) * s.freeagent_mean)
    END AS freeagent_score,
    sp.v AS saltnpepper_evidence,
    sp.raw AS saltnpepper_raw,
    CASE WHEN sp.v IS NOT NULL THEN
      ROUND((sp.v::numeric / (sp.v + c.m_saltnpepper)) * sp.raw + (c.m_saltnpepper::numeric / (sp.v + c.m_saltnpepper)) * s.saltnpepper_mean)
    END AS saltnpepper_score,
    gm.v AS greymatters_evidence,
    gm.raw AS greymatters_raw,
    CASE WHEN gm.v IS NOT NULL THEN
      ROUND((gm.v::numeric / (gm.v + c.m_greymatters)) * gm.raw + (c.m_greymatters::numeric / (gm.v + c.m_greymatters)) * s.greymatters_mean)
    END AS greymatters_score,
    s.stackedge_headcount, s.freeagent_headcount, s.saltnpepper_headcount, s.greymatters_headcount
  FROM public.profiles p
  CROSS JOIN constants c
  CROSS JOIN platform_stats s
  LEFT JOIN stackedge_raw pr ON pr.user_id = p.id
  LEFT JOIN freeagent_raw fa ON fa.user_id = p.id
  LEFT JOIN saltnpepper_raw sp ON sp.user_id = p.id
  LEFT JOIN greymatters_raw gm ON gm.user_id = p.id
),
scored AS (
  SELECT
    user_id,
    stackedge_score, stackedge_evidence, stackedge_headcount,
    freeagent_score, freeagent_evidence, freeagent_headcount,
    saltnpepper_score, saltnpepper_evidence, saltnpepper_headcount,
    greymatters_score, greymatters_evidence, greymatters_headcount,
    years_experience,
    ROUND(
      (
        COALESCE(stackedge_score * LN(stackedge_headcount + 1), 0) +
        COALESCE(freeagent_score * LN(freeagent_headcount + 1), 0) +
        COALESCE(saltnpepper_score * LN(saltnpepper_headcount + 1), 0) +
        COALESCE(greymatters_score * LN(greymatters_headcount + 1), 0)
      ) / NULLIF(
        (CASE WHEN stackedge_score IS NOT NULL THEN LN(stackedge_headcount + 1) ELSE 0 END) +
        (CASE WHEN freeagent_score IS NOT NULL THEN LN(freeagent_headcount + 1) ELSE 0 END) +
        (CASE WHEN saltnpepper_score IS NOT NULL THEN LN(saltnpepper_headcount + 1) ELSE 0 END) +
        (CASE WHEN greymatters_score IS NOT NULL THEN LN(greymatters_headcount + 1) ELSE 0 END),
        0
      )
    ) AS platform_composite,
    CASE WHEN stackedge_score IS NOT NULL OR freeagent_score IS NOT NULL OR saltnpepper_score IS NOT NULL OR greymatters_score IS NOT NULL THEN
      ROUND(
        0.85 * (
          (
            COALESCE(stackedge_score * LN(stackedge_headcount + 1), 0) +
            COALESCE(freeagent_score * LN(freeagent_headcount + 1), 0) +
            COALESCE(saltnpepper_score * LN(saltnpepper_headcount + 1), 0) +
            COALESCE(greymatters_score * LN(greymatters_headcount + 1), 0)
          ) / NULLIF(
            (CASE WHEN stackedge_score IS NOT NULL THEN LN(stackedge_headcount + 1) ELSE 0 END) +
            (CASE WHEN freeagent_score IS NOT NULL THEN LN(freeagent_headcount + 1) ELSE 0 END) +
            (CASE WHEN saltnpepper_score IS NOT NULL THEN LN(saltnpepper_headcount + 1) ELSE 0 END) +
            (CASE WHEN greymatters_score IS NOT NULL THEN LN(greymatters_headcount + 1) ELSE 0 END),
            0
          )
        ) + 0.15 * (LEAST(COALESCE(years_experience, 0), 20) / 20.0 * 100)
      )
    END AS greyin_score
  FROM per_user
)
SELECT
  *,
  (
    COALESCE(years_experience, 0) >= (SELECT min_years_experience FROM public.platform_gate_settings WHERE id = 1)
    OR COALESCE(greyin_score, 0) >= (SELECT min_greyin_score FROM public.platform_gate_settings WHERE id = 1)
  ) AS is_verified_expert
FROM scored;

GRANT SELECT ON public.greyin_scores TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
