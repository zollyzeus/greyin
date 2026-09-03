-- ============================================================
-- Full internal rename: prolab -> stackedge
-- ============================================================
--
-- The earlier StackEdge rebrand (approved, shipped, verified) only
-- renamed user-facing text; every internal identifier -- this column,
-- the pillar_memberships value, the RLS policy, the trigger function,
-- and every scoring/search/activity view built on top of them -- was
-- deliberately left as 'prolab', matching the ExpertEdge precedent.
-- This migration finishes the job on the DB side: renames the internal
-- identifier everywhere it appears, with zero change to any scoring
-- formula, RLS boundary, or table shape. Every view below is a
-- CREATE OR REPLACE of the exact same shape it already had (041 for
-- greyin_scores, 037 for platform_search_index, 046 for
-- my_pillar_activity) with only prolab->stackedge substitutions.
--
-- Migration filenames 030_prolab_launch.sql and
-- 035_prolab_people_directory.sql are deliberately NOT renamed -- they're
-- historical record of what actually ran, same reason git commit
-- messages aren't rewritten after the fact.
--
-- Run this after 046_pillar_activity_view.sql
-- ============================================================

-- ------------------------------------------------------------
-- profiles.prolab_role -> stackedge_role
-- ------------------------------------------------------------
-- RENAME COLUMN carries the data and updates the column's own CHECK
-- constraint definition automatically -- no separate constraint rename
-- needed. Guarded so this migration can be safely re-run after a partial
-- failure further down.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'prolab_role'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN prolab_role TO stackedge_role;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.stackedge_role IS
  'Which track the user chose when signing up directly on stackedge.greyin.net. NULL for users who only ever reached StackEdge via SSO from another pillar (e.g. an existing Salt & Pepper member) -- their Builder eligibility is derived from years_experience >= 12 instead, not this column.';

-- ------------------------------------------------------------
-- pillar_memberships: value 'prolab' -> 'stackedge'
-- ------------------------------------------------------------
-- Constraint must drop before the UPDATE -- the old CHECK only allows
-- 'prolab', so swapping the value first would violate it.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.pillar_memberships'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%pillar%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pillar_memberships DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

UPDATE public.pillar_memberships SET pillar = 'stackedge' WHERE pillar = 'prolab';

ALTER TABLE public.pillar_memberships
  ADD CONSTRAINT pillar_memberships_pillar_check
  CHECK (pillar = ANY (ARRAY['greyin', 'greymatters', 'saltnpepper', 'freeagent', 'stackedge']));

-- ------------------------------------------------------------
-- RLS policy from 035: renamed + pillar = 'stackedge'
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone authenticated can view prolab pillar memberships" ON public.pillar_memberships;
DROP POLICY IF EXISTS "Anyone authenticated can view stackedge pillar memberships" ON public.pillar_memberships;

CREATE POLICY "Anyone authenticated can view stackedge pillar memberships"
  ON public.pillar_memberships FOR SELECT
  USING (auth.role() = 'authenticated' AND pillar = 'stackedge');

-- ------------------------------------------------------------
-- handle_email_confirmed(): 038's version (the current/final one),
-- with stackedge_role/'stackedge' in place of prolab_role/'prolab'
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  meta JSONB := NEW.raw_user_meta_data;
  user_role TEXT := COALESCE(meta->>'role', 'candidate');
  full_name TEXT := trim(concat(meta->>'first_name', ' ', meta->>'last_name'));
  v_pillar TEXT;
  v_stackedge_role TEXT := meta->>'stackedge_role';
  v_years_experience INTEGER := NULLIF(meta->>'years_experience', '')::INTEGER;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, years_experience, stackedge_role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(full_name, ''),
    user_role,
    v_years_experience,
    v_stackedge_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role = EXCLUDED.role,
    years_experience = COALESCE(EXCLUDED.years_experience, public.profiles.years_experience),
    stackedge_role = COALESCE(EXCLUDED.stackedge_role, public.profiles.stackedge_role),
    updated_at = NOW();

  IF user_role = 'employer' THEN
    INSERT INTO public.companies (user_id, name, slug)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(full_name, ''), NEW.email) || '''s Company',
      'company-' || substr(NEW.id::text, 1, 8)
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF user_role = 'candidate' THEN
    INSERT INTO public.candidates (user_id, experience_years)
    VALUES (NEW.id, v_years_experience)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  v_pillar := CASE
    WHEN user_role IN ('candidate', 'employer') THEN 'greyin'
    WHEN user_role IN ('client', 'freelancer') THEN 'freeagent'
    WHEN user_role = 'member' THEN 'saltnpepper'
    WHEN user_role IN ('author', 'follower') THEN 'greymatters'
  END;
  IF v_pillar IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, v_pillar, user_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  IF v_stackedge_role IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, 'stackedge', v_stackedge_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- greyin_scores: 041's version (the current/final one), every
-- prolab_* identifier renamed to stackedge_*. Formula weights and math
-- untouched -- pure rename of the same view shape it's already had
-- twice before (036, 038, 041).
-- ------------------------------------------------------------
-- DROP + CREATE, not CREATE OR REPLACE -- Postgres refuses to
-- CREATE OR REPLACE a view when the output column names change
-- (prolab_score -> stackedge_score etc.), even though the shape is
-- otherwise identical. Four RLS policies from 038 (on posts/comments)
-- reference this view via a `user_id`/`is_verified_expert` subquery --
-- neither of those column names changes here, but Postgres still
-- registers a hard dependency and CASCADE will drop the policies along
-- with the view, so they're recreated byte-identical (confirmed via
-- pg_policies against prod) immediately after.
DROP VIEW IF EXISTS public.greyin_scores CASCADE;

CREATE VIEW public.greyin_scores AS
WITH constants AS (
  SELECT 3 AS m_stackedge, 5 AS m_freeagent, 10 AS m_saltnpepper
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
platform_stats AS (
  SELECT
    (SELECT AVG(raw) FROM stackedge_raw) AS stackedge_mean,
    (SELECT COUNT(*) FROM stackedge_raw) AS stackedge_headcount,
    (SELECT AVG(raw) FROM freeagent_raw) AS freeagent_mean,
    (SELECT COUNT(*) FROM freeagent_raw) AS freeagent_headcount,
    (SELECT AVG(raw) FROM saltnpepper_raw) AS saltnpepper_mean,
    (SELECT COUNT(*) FROM saltnpepper_raw) AS saltnpepper_headcount
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
    s.stackedge_headcount, s.freeagent_headcount, s.saltnpepper_headcount
  FROM public.profiles p
  CROSS JOIN constants c
  CROSS JOIN platform_stats s
  LEFT JOIN stackedge_raw pr ON pr.user_id = p.id
  LEFT JOIN freeagent_raw fa ON fa.user_id = p.id
  LEFT JOIN saltnpepper_raw sp ON sp.user_id = p.id
),
scored AS (
  SELECT
    user_id,
    stackedge_score, stackedge_evidence, stackedge_headcount,
    freeagent_score, freeagent_evidence, freeagent_headcount,
    saltnpepper_score, saltnpepper_evidence, saltnpepper_headcount,
    years_experience,
    ROUND(
      (
        COALESCE(stackedge_score * LN(stackedge_headcount + 1), 0) +
        COALESCE(freeagent_score * LN(freeagent_headcount + 1), 0) +
        COALESCE(saltnpepper_score * LN(saltnpepper_headcount + 1), 0)
      ) / NULLIF(
        (CASE WHEN stackedge_score IS NOT NULL THEN LN(stackedge_headcount + 1) ELSE 0 END) +
        (CASE WHEN freeagent_score IS NOT NULL THEN LN(freeagent_headcount + 1) ELSE 0 END) +
        (CASE WHEN saltnpepper_score IS NOT NULL THEN LN(saltnpepper_headcount + 1) ELSE 0 END),
        0
      )
    ) AS platform_composite,
    CASE WHEN stackedge_score IS NOT NULL OR freeagent_score IS NOT NULL OR saltnpepper_score IS NOT NULL THEN
      ROUND(
        0.85 * (
          (
            COALESCE(stackedge_score * LN(stackedge_headcount + 1), 0) +
            COALESCE(freeagent_score * LN(freeagent_headcount + 1), 0) +
            COALESCE(saltnpepper_score * LN(saltnpepper_headcount + 1), 0)
          ) / NULLIF(
            (CASE WHEN stackedge_score IS NOT NULL THEN LN(stackedge_headcount + 1) ELSE 0 END) +
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
-- Recreate the 4 posts/comments RLS policies CASCADE just dropped --
-- byte-identical to 038's definitions (confirmed against prod via
-- pg_policies before this migration ran), since is_verified_expert/
-- user_id aren't among the renamed columns.
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

-- ------------------------------------------------------------
-- platform_search_index: 037's version, 'prolab' -> 'stackedge'
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.platform_search_index AS
  SELECT 'post'::text AS type,
    'greymatters'::text AS pillar,
    posts.id,
    posts.title,
    posts.excerpt AS description,
    '/posts/'::text || posts.slug AS path,
    posts.created_at
  FROM posts
  WHERE posts.status = 'published'::text
UNION ALL
  SELECT 'job'::text AS type,
    'greyin'::text AS pillar,
    jobs.id,
    jobs.title,
    jobs.description,
    '/jobs/'::text || jobs.id AS path,
    jobs.created_at
  FROM jobs
  WHERE jobs.status = 'open'::text
UNION ALL
  SELECT 'gig'::text AS type,
    'freeagent'::text AS pillar,
    gigs.id,
    gigs.title,
    gigs.description,
    '/gigs/'::text || gigs.id AS path,
    gigs.created_at
  FROM gigs
  WHERE gigs.status = 'active'::text
UNION ALL
  SELECT 'discussion'::text AS type,
    'saltnpepper'::text AS pillar,
    discussions.id,
    discussions.title,
    discussions.body AS description,
    '/discussions/'::text || discussions.id AS path,
    discussions.created_at
  FROM discussions
UNION ALL
  SELECT 'project'::text AS type,
    'stackedge'::text AS pillar,
    builder_projects.id,
    builder_projects.title,
    builder_projects.description,
    '/projects/'::text || builder_projects.id AS path,
    builder_projects.created_at
  FROM builder_projects;

-- ------------------------------------------------------------
-- my_pillar_activity: 046's version, 'prolab' -> 'stackedge'
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.my_pillar_activity AS
SELECT * FROM (
  SELECT subject_user_id AS user_id, 'stackedge' AS pillar, 'verified_outcome' AS event_type, created_at AS occurred_at FROM public.verified_outcomes
  UNION ALL
  SELECT user_id, 'stackedge', 'project_created', created_at FROM public.builder_projects
  UNION ALL
  SELECT created_by, 'stackedge', 'ask_created', created_at FROM public.project_asks
  UNION ALL
  SELECT reviewee_id, 'freeagent', 'review_received', created_at FROM public.order_reviews
  UNION ALL
  SELECT freelancer_id, 'freeagent', 'gig_listed', created_at FROM public.gigs
  UNION ALL
  SELECT author_id, 'saltnpepper', 'discussion', created_at FROM public.discussions
  UNION ALL
  SELECT author_id, 'saltnpepper', 'discussion_reply', created_at FROM public.discussion_replies
  UNION ALL
  SELECT author_id, 'greymatters', 'post', created_at FROM public.posts WHERE author_id IS NOT NULL
  UNION ALL
  SELECT user_id, 'greymatters', 'comment', created_at FROM public.comments
  UNION ALL
  SELECT c.user_id, 'expertedge', 'application', a.applied_at FROM public.applications a JOIN public.candidates c ON c.id = a.candidate_id
  UNION ALL
  SELECT co.user_id, 'expertedge', 'job_posted', j.created_at FROM public.jobs j JOIN public.companies co ON co.id = j.company_id
) t
WHERE user_id = auth.uid();

GRANT SELECT ON public.my_pillar_activity TO authenticated;

-- ------------------------------------------------------------
-- llm_feature_flags: 'prolab_verification' -> 'stackedge_verification'
-- ------------------------------------------------------------
UPDATE public.llm_feature_flags
  SET feature_key = 'stackedge_verification'
  WHERE feature_key = 'prolab_verification';

NOTIFY pgrst, 'reload schema';
