-- ============================================================
-- AI quality scoring: local-Ollama-backed content review, extended to
-- GreyMatters/Salt & Pepper/FreeAgent, plus GreyMatters becomes a 4th
-- greyin_score platform input
-- ============================================================
--
-- StackEdge already had a working, admin-configurable AI review pipeline
-- (llm_providers/llm_feature_flags + the provider-agnostic complete()
-- client) that scored submitted work into verified_outcomes.ai_score --
-- but no provider was actually configured until a local Ollama fallback
-- was added directly via the admin panel (qwen2.5-coder:14b, no API key,
-- priority 100 so a future paid key would still be tried first).
--
-- This migration extends the same idea to the three pillars that don't
-- have it yet, via one new shared table (ai_quality_scores, following
-- verified_outcomes' "one nullable FK per content type" shape rather
-- than a generic content_id -- matches migration 011's lesson that
-- PostgREST embeds and referential integrity need a real FK).
--
-- GreyMatters is the one pillar whose Verified-Expert-gated authorship
-- (038's "Verified experts can insert posts" policy) contributes zero
-- evidence back into greyin_scores -- a real asymmetry against
-- StackEdge/FreeAgent/Salt & Pepper, which all feed real evidence in.
-- So GreyMatters' AI quality score becomes a genuine 4th platform input,
-- following the exact same Bayesian-shrinkage + log-headcount-weighted
-- blend the other 3 already use. FreeAgent's delivery-quality and
-- Salt & Pepper's reply-quality scores stay additive/informational only
-- -- those two pillars already have real evidence-based inputs (seller
-- ratings, reputation events), so there's no equivalent gap to close.
--
-- Safe by construction: on the day this runs, ai_quality_scores has zero
-- greymatters_post rows, so greymatters_score is NULL for every user and
-- the view's existing "IS NOT NULL" guards exclude it from
-- platform_composite for everyone -- identical behavior to today. It
-- only starts influencing anyone's greyin_score once posts actually get
-- scored, going forward.
--
-- Run this after 047_rename_prolab_to_stackedge.sql
-- ============================================================

-- ------------------------------------------------------------
-- ai_quality_scores
-- ------------------------------------------------------------
CREATE TABLE public.ai_quality_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  content_type TEXT CHECK (content_type IN ('greymatters_post', 'saltnpepper_reply', 'freeagent_delivery')) NOT NULL,
  post_id UUID REFERENCES public.posts ON DELETE CASCADE,
  discussion_reply_id UUID REFERENCES public.discussion_replies ON DELETE CASCADE,
  gig_order_id UUID REFERENCES public.gig_orders ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  notes TEXT,
  provider TEXT,
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT ai_quality_scores_content_shape CHECK (
    (content_type = 'greymatters_post'   AND post_id IS NOT NULL AND discussion_reply_id IS NULL AND gig_order_id IS NULL) OR
    (content_type = 'saltnpepper_reply'  AND discussion_reply_id IS NOT NULL AND post_id IS NULL AND gig_order_id IS NULL) OR
    (content_type = 'freeagent_delivery' AND gig_order_id IS NOT NULL AND post_id IS NULL AND discussion_reply_id IS NULL)
  ),
  UNIQUE (post_id),
  UNIQUE (discussion_reply_id),
  UNIQUE (gig_order_id)
);

COMMENT ON TABLE public.ai_quality_scores IS 'AI-rated quality of an expert''s own contribution (blog writeup, mentoring reply, gig delivery). greymatters_post rows feed greyin_scores as a 4th platform input; saltnpepper_reply/freeagent_delivery rows are additive/informational only.';

ALTER TABLE public.ai_quality_scores ENABLE ROW LEVEL SECURITY;

-- Public, same bar as order_reviews' "Reviews are publicly viewable" --
-- shown on already-public pages (posts, profiles), not gated like
-- llm_providers' credentials.
CREATE POLICY "Anyone can view AI quality scores"
  ON public.ai_quality_scores FOR SELECT
  USING (true);

-- 100% system-generated via each app's service-role client, same trust
-- model as verified_outcomes.ai_* -- nothing user-facing ever writes
-- here. Admin ALL exists only so a bad score can be hand-corrected
-- without another migration.
CREATE POLICY "Admins manage AI quality scores"
  ON public.ai_quality_scores FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX idx_ai_quality_scores_subject_user_id ON public.ai_quality_scores(subject_user_id);
CREATE INDEX idx_ai_quality_scores_content_type ON public.ai_quality_scores(content_type);

GRANT SELECT ON public.ai_quality_scores TO anon, authenticated;

-- ------------------------------------------------------------
-- llm_feature_flags: 3 new pillar-scoped flags, same shared
-- provider pool (the Ollama fallback already configured) as
-- stackedge_verification
-- ------------------------------------------------------------
INSERT INTO public.llm_feature_flags (feature_key, enabled) VALUES
  ('greymatters_post_quality', true),
  ('saltnpepper_reply_quality', true),
  ('freeagent_delivery_quality', true);

-- ------------------------------------------------------------
-- greyin_scores: GreyMatters becomes a 4th platform input.
-- DROP + CREATE, not CREATE OR REPLACE -- the output column set
-- changes (new greymatters_score/evidence/headcount columns), which
-- Postgres refuses for CREATE OR REPLACE VIEW (same issue hit in 047).
-- CASCADE drops the 4 posts/comments RLS policies that read through
-- this view; they're recreated byte-identical immediately after.
-- ------------------------------------------------------------
DROP VIEW IF EXISTS public.greyin_scores CASCADE;

CREATE VIEW public.greyin_scores AS
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

-- ------------------------------------------------------------
-- Recreate the 4 posts/comments RLS policies CASCADE just dropped --
-- byte-identical to 038's/047's definitions, since is_verified_expert/
-- user_id aren't among the columns that changed.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Published posts respect their view audience" ON public.posts;

CREATE POLICY "Published posts respect their view audience"
  ON public.posts FOR SELECT
  USING (
    status = 'published' AND (
      view_audience = 'public'
      OR (view_audience = 'follower' AND auth.role() = 'authenticated')
      OR (view_audience = 'verified_expert' AND EXISTS (
        SELECT 1 FROM public.greyin_scores WHERE user_id = auth.uid() AND is_verified_expert
      ))
    )
  );

DROP POLICY IF EXISTS "Verified experts can insert posts" ON public.posts;

CREATE POLICY "Verified experts can insert posts"
  ON public.posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id AND (
      EXISTS (SELECT 1 FROM public.greyin_scores WHERE user_id = auth.uid() AND is_verified_expert)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

DROP POLICY IF EXISTS "Approved comments respect their post's comment audience" ON public.comments;

CREATE POLICY "Approved comments respect their post's comment audience"
  ON public.comments FOR SELECT
  USING (
    status = 'approved' AND EXISTS (
      SELECT 1 FROM public.posts p WHERE p.id = comments.post_id AND (
        p.comment_audience = 'public'
        OR (p.comment_audience = 'follower' AND auth.role() = 'authenticated')
        OR (p.comment_audience = 'verified_expert' AND EXISTS (
          SELECT 1 FROM public.greyin_scores WHERE user_id = auth.uid() AND is_verified_expert
        ))
      )
    )
  );

DROP POLICY IF EXISTS "Comments respect their post's comment audience" ON public.comments;

CREATE POLICY "Comments respect their post's comment audience"
  ON public.comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.posts p WHERE p.id = comments.post_id AND (
        p.comment_audience = 'public'
        OR (p.comment_audience = 'follower' AND auth.role() = 'authenticated')
        OR (p.comment_audience = 'verified_expert' AND EXISTS (
          SELECT 1 FROM public.greyin_scores WHERE user_id = auth.uid() AND is_verified_expert
        ))
      )
    )
  );

NOTIFY pgrst, 'reload schema';
