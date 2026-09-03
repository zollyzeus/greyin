-- ============================================================
-- Unified "Greyin Score" -- Algorithm B (Bayesian-adjusted, headcount-weighted)
-- ============================================================
--
-- Combines the three independent trust signals that already exist
-- (Prolab verified_outcomes, FreeAgent seller_rating/order_reviews,
-- Salt & Pepper reputation_events) into one cross-platform score, plus
-- career experience. Chosen over a straight average or an LLM
-- meta-score for two reasons: (1) it's the same Bayesian-shrinkage
-- formula IMDB/Reddit/Steam already use to solve the exact
-- cold-start problem this ecosystem has today (one lucky 100/100
-- outcome shouldn't outrank someone with 50 solid 80s), and (2) it's
-- pure SQL -- no dependency on an AI provider ever being configured.
--
-- Per platform: WR = (v/(v+m))*R + (m/(v+m))*C
--   R = the person's own raw average on that platform (0-100 scale)
--   v = how much evidence exists for THIS person on that platform
--   C = the platform-wide mean (among people with any evidence there)
--   m = a per-platform "how much evidence counts as fully trusted"
--       constant -- tunable, not derived from anything
--
-- Composite = headcount-weighted average of whichever WRs a person
-- has (log-dampened so one very large platform doesn't totally drown
-- out the others), then blended 85/15 with a career-experience term
-- (years_experience capped at 20, so this isn't just a seniority
-- contest). NULL for anyone with zero evidence on every platform --
-- no score is shown rather than a misleading 0.
--
-- View (not a table) so it's always current, same convention as
-- 025's reputation_scores. Runs as the view owner (postgres), so it
-- can aggregate through verified_outcomes/reputation_events
-- regardless of those tables' own RLS -- safe here because every CTE
-- below only ever touches already-public data (verified_outcomes
-- filtered to status='verified', profiles' seller_rating is
-- unconditionally public, reputation_events' own RLS is already
-- "viewable by everyone" per 025).
--
-- Run this after 035_prolab_people_directory.sql
-- ============================================================

CREATE OR REPLACE VIEW public.greyin_scores AS
WITH constants AS (
  SELECT 3 AS m_prolab, 5 AS m_freeagent, 10 AS m_saltnpepper
),
prolab_raw AS (
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
  GROUP BY user_id
),
platform_stats AS (
  SELECT
    (SELECT AVG(raw) FROM prolab_raw) AS prolab_mean,
    (SELECT COUNT(*) FROM prolab_raw) AS prolab_headcount,
    (SELECT AVG(raw) FROM freeagent_raw) AS freeagent_mean,
    (SELECT COUNT(*) FROM freeagent_raw) AS freeagent_headcount,
    (SELECT AVG(raw) FROM saltnpepper_raw) AS saltnpepper_mean,
    (SELECT COUNT(*) FROM saltnpepper_raw) AS saltnpepper_headcount
),
per_user AS (
  SELECT
    p.id AS user_id,
    p.years_experience,
    pr.v AS prolab_evidence,
    pr.raw AS prolab_raw,
    CASE WHEN pr.v IS NOT NULL THEN
      ROUND((pr.v::numeric / (pr.v + c.m_prolab)) * pr.raw + (c.m_prolab::numeric / (pr.v + c.m_prolab)) * s.prolab_mean)
    END AS prolab_score,
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
    s.prolab_headcount, s.freeagent_headcount, s.saltnpepper_headcount
  FROM public.profiles p
  CROSS JOIN constants c
  CROSS JOIN platform_stats s
  LEFT JOIN prolab_raw pr ON pr.user_id = p.id
  LEFT JOIN freeagent_raw fa ON fa.user_id = p.id
  LEFT JOIN saltnpepper_raw sp ON sp.user_id = p.id
)
SELECT
  user_id,
  prolab_score, prolab_evidence, prolab_headcount,
  freeagent_score, freeagent_evidence, freeagent_headcount,
  saltnpepper_score, saltnpepper_evidence, saltnpepper_headcount,
  years_experience,
  ROUND(
    (
      COALESCE(prolab_score * LN(prolab_headcount + 1), 0) +
      COALESCE(freeagent_score * LN(freeagent_headcount + 1), 0) +
      COALESCE(saltnpepper_score * LN(saltnpepper_headcount + 1), 0)
    ) / NULLIF(
      (CASE WHEN prolab_score IS NOT NULL THEN LN(prolab_headcount + 1) ELSE 0 END) +
      (CASE WHEN freeagent_score IS NOT NULL THEN LN(freeagent_headcount + 1) ELSE 0 END) +
      (CASE WHEN saltnpepper_score IS NOT NULL THEN LN(saltnpepper_headcount + 1) ELSE 0 END),
      0
    )
  ) AS platform_composite,
  CASE WHEN prolab_score IS NOT NULL OR freeagent_score IS NOT NULL OR saltnpepper_score IS NOT NULL THEN
    ROUND(
      0.85 * (
        (
          COALESCE(prolab_score * LN(prolab_headcount + 1), 0) +
          COALESCE(freeagent_score * LN(freeagent_headcount + 1), 0) +
          COALESCE(saltnpepper_score * LN(saltnpepper_headcount + 1), 0)
        ) / NULLIF(
          (CASE WHEN prolab_score IS NOT NULL THEN LN(prolab_headcount + 1) ELSE 0 END) +
          (CASE WHEN freeagent_score IS NOT NULL THEN LN(freeagent_headcount + 1) ELSE 0 END) +
          (CASE WHEN saltnpepper_score IS NOT NULL THEN LN(saltnpepper_headcount + 1) ELSE 0 END),
          0
        )
      ) + 0.15 * (LEAST(COALESCE(years_experience, 0), 20) / 20.0 * 100)
    )
  END AS greyin_score
FROM per_user;

GRANT SELECT ON public.greyin_scores TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
