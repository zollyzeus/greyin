-- ============================================================
-- Advisory governance voting on the Verified Expert eligibility threshold
-- ============================================================
--
-- Phase 6 of the revamp plan. Every pillar member can vote on where the
-- years-of-experience / Greyin Score bar should sit, tallied into two
-- separate buckets (already-Verified-Expert vs. everyone else) so admins
-- can see whether the two groups actually agree, rather than one number
-- that could be swayed by a newly-arrived cohort voting itself in.
--
-- Advisory only, per the user's direction: nothing here auto-applies a
-- vote result. platform_gate_settings is the one live value every gate
-- in the codebase reads -- an admin has to deliberately update it via
-- the admin dashboard for a vote to take effect anywhere.
-- ============================================================

CREATE TABLE public.platform_gate_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_years_experience INT NOT NULL DEFAULT 12,
  min_greyin_score INT NOT NULL DEFAULT 75,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.platform_gate_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.platform_gate_settings TO anon, authenticated;

ALTER TABLE public.platform_gate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view the live gate settings"
  ON public.platform_gate_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update gate settings"
  ON public.platform_gate_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ------------------------------------------------------------
-- greyin_scores: is_verified_expert now reads the live settings row
-- instead of the literals 12 / 75 that migration 038 hardcoded.
-- Re-evaluated per query (it's a view), so a settings change takes
-- effect immediately everywhere this view is read.
-- ------------------------------------------------------------
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
),
scored AS (
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

-- ------------------------------------------------------------
-- threshold_votes: one row per member, upserted -- a member can change
-- their mind. RLS restricts everyone (including admins) to only ever
-- seeing/writing their own row; the two-bucket aggregate below is the
-- only way to see the full picture, and that's gated to admins inside
-- the function itself.
-- ------------------------------------------------------------
CREATE TABLE public.threshold_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_years INT NOT NULL CHECK (proposed_years >= 0),
  proposed_score INT NOT NULL CHECK (proposed_score BETWEEN 0 AND 100),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.threshold_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vote"
  ON public.threshold_votes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can cast their own vote"
  ON public.threshold_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change their own vote"
  ON public.threshold_votes FOR UPDATE
  USING (auth.uid() = user_id);

-- Admin-only aggregate, bucketed by current is_verified_expert status.
-- A function (checking auth.uid() internally) rather than a bare view,
-- so the admin gate lives at the DB layer and not just in the page's
-- own role check -- matches the trust model migration 022's
-- ensure_pillar_membership() already established for cross-cutting RPCs.
CREATE OR REPLACE FUNCTION public.get_threshold_vote_summary()
RETURNS TABLE (
  bucket_verified_expert BOOLEAN,
  vote_count BIGINT,
  avg_proposed_years NUMERIC,
  avg_proposed_score NUMERIC,
  median_proposed_years NUMERIC,
  median_proposed_score NUMERIC
)
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  -- percentile_cont() returns double precision, not numeric -- cast
  -- explicitly so every numeric column in this RETURNS TABLE actually
  -- matches its declared type (the earlier version of this function
  -- omitted the cast and Postgres rejected every call with "structure of
  -- query does not match function result type").
  RETURN QUERY
  SELECT
    gs.is_verified_expert AS bucket_verified_expert,
    COUNT(*) AS vote_count,
    ROUND(AVG(tv.proposed_years), 1) AS avg_proposed_years,
    ROUND(AVG(tv.proposed_score), 1) AS avg_proposed_score,
    (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY tv.proposed_years))::NUMERIC AS median_proposed_years,
    (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY tv.proposed_score))::NUMERIC AS median_proposed_score
  FROM public.threshold_votes tv
  JOIN public.greyin_scores gs ON gs.user_id = tv.user_id
  GROUP BY gs.is_verified_expert;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_threshold_vote_summary() TO authenticated;

NOTIFY pgrst, 'reload schema';
