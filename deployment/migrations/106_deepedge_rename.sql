-- ============================================================
-- App 3 Tier 3: greyin(-b2b)/expertedge -> deepedge, live database objects
-- ============================================================
--
-- Final app of the same user-directed full internal rename as
-- 103/104_flexpro_rename*.sql and 105_stackworks_rename.sql. Simpler
-- than either of those: this app has no per-app column analogous to
-- stackworks_role, and it is not one of the scored pillars inside the
-- greyin_scores view (its CTEs are stackworks_raw/flexpro_raw/
-- saltnpepper_raw/greymatters_raw/peer_raw only) -- so no
-- DROP VIEW ... CASCADE is needed here.
--
-- The literal being renamed is the bare pillar tag `'greyin'` used by
-- this specific app (candidate/employer signups, jobs) -- carefully
-- confirmed distinct from `greyin_score`/`greyin_scores` (the
-- platform-wide composite reputation system, explicitly out of
-- scope), `greyin_hub` (a different app's own separate pillar tag),
-- and the `greyin.net`/`.greyin.net` domain and SSO cookie domain
-- (also out of scope, never touched). Catalogued by reading all 105
-- existing migration files for the latest authoritative definition of
-- every object using this literal, then cross-checked against the
-- live database (pg_constraint, pg_class.reloptions, row counts)
-- before writing this file.
--
-- One added wrinkle this app has that neither prior app did: it also
-- carries a SECOND, even older pillar-tag literal, `'expertedge'`,
-- used inconsistently in `my_pillar_activity` while every other view
-- already uses `'greyin'` for the same app -- a pre-existing
-- inconsistency 053_activity_feed.sql's own comment already flagged
-- at the time. Both literals are renamed to `'deepedge'` here,
-- resolving the inconsistency rather than carrying two different
-- stale names forward.
--
-- Live row count confirmed immediately before writing this migration
-- (2026-09-03): pillar_memberships.pillar='greyin' (36).
-- activity_feed and platform_search_index carry security_invoker=true
-- live (reissued below after CREATE OR REPLACE resets it, same as
-- 103/105); my_pillar_activity does not (none added, matching its
-- existing live state).
--
-- Run this after 105_stackworks_rename.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. handle_email_confirmed() -- fires on every signup, any pillar.
-- 105's exact current body, reproduced byte-for-byte except the
-- 'greyin' pillar literal this migration exists to change.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  meta JSONB := NEW.raw_user_meta_data;
  user_role TEXT := COALESCE(meta->>'role', 'candidate');
  full_name TEXT := trim(concat(meta->>'first_name', ' ', meta->>'last_name'));
  v_pillar TEXT;
  v_stackworks_role TEXT := meta->>'stackworks_role';
  v_years_experience INTEGER := NULLIF(meta->>'years_experience', '')::INTEGER;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF user_role = 'admin' THEN
    user_role := 'candidate';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, years_experience, stackworks_role)
  VALUES (
    NEW.id, NEW.email, NULLIF(full_name, ''), user_role,
    v_years_experience, v_stackworks_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role = EXCLUDED.role,
    years_experience = COALESCE(EXCLUDED.years_experience, public.profiles.years_experience),
    stackworks_role = COALESCE(EXCLUDED.stackworks_role, public.profiles.stackworks_role),
    updated_at = NOW();

  IF user_role = 'employer' THEN
    INSERT INTO public.companies (user_id, name, slug)
    VALUES (NEW.id, COALESCE(NULLIF(full_name, ''), NEW.email) || '''s Company', 'company-' || substr(NEW.id::text, 1, 8))
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF user_role = 'candidate' THEN
    INSERT INTO public.candidates (user_id, experience_years)
    VALUES (NEW.id, v_years_experience)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  v_pillar := CASE
    WHEN user_role IN ('candidate', 'employer') THEN 'deepedge'
    WHEN user_role IN ('client', 'freelancer') THEN 'flexpro'
    WHEN user_role = 'member' THEN 'saltnpepper'
    WHEN user_role IN ('author', 'follower') THEN 'greymatters'
  END;
  IF v_pillar IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, v_pillar, user_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  IF v_stackworks_role IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, 'stackworks', v_stackworks_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- 2. The 3 UNION ALL views carrying this app's pillar tag as a
-- literal value -- collaborators confirmed NOT in scope (no
-- 'greyin'/'expertedge' literal anywhere in it, catalogued and
-- verified). platform_search_index and activity_feed reissue
-- security_invoker=true (CREATE OR REPLACE VIEW resets it);
-- my_pillar_activity has none live today, so none added here either.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.platform_search_index AS
  SELECT 'post'::text AS type,
    'greymatters'::text AS pillar,
    posts.id, posts.title, posts.excerpt AS description,
    '/posts/'::text || posts.slug AS path, posts.created_at
  FROM posts WHERE posts.status = 'published'::text
UNION ALL
  SELECT 'job'::text AS type,
    'deepedge'::text AS pillar,
    jobs.id, jobs.title, jobs.description,
    '/jobs/'::text || jobs.id AS path, jobs.created_at
  FROM jobs WHERE jobs.status = 'open'::text
UNION ALL
  SELECT 'gig'::text AS type,
    'flexpro'::text AS pillar,
    gigs.id, gigs.title, gigs.description,
    '/gigs/'::text || gigs.id AS path, gigs.created_at
  FROM gigs WHERE gigs.status = 'active'::text
UNION ALL
  SELECT 'discussion'::text AS type,
    'saltnpepper'::text AS pillar,
    discussions.id, discussions.title, discussions.body AS description,
    '/discussions/'::text || discussions.id AS path, discussions.created_at
  FROM discussions
UNION ALL
  SELECT 'project'::text AS type,
    'stackworks'::text AS pillar,
    builder_projects.id, builder_projects.title, builder_projects.description,
    '/projects/'::text || builder_projects.id AS path, builder_projects.created_at
  FROM builder_projects;

ALTER VIEW public.platform_search_index SET (security_invoker = true);

-- Resolves the pre-existing 'expertedge' vs 'greyin' inconsistency
-- 053_activity_feed.sql's own comment flagged at the time -- both
-- branches now say 'deepedge', matching every other view.
CREATE OR REPLACE VIEW public.my_pillar_activity AS
SELECT * FROM (
  SELECT subject_user_id AS user_id, 'stackworks' AS pillar, 'verified_outcome' AS event_type, created_at AS occurred_at FROM public.verified_outcomes
  UNION ALL
  SELECT user_id, 'stackworks', 'project_created', created_at FROM public.builder_projects
  UNION ALL
  SELECT created_by, 'stackworks', 'ask_created', created_at FROM public.project_asks
  UNION ALL
  SELECT reviewee_id, 'flexpro', 'review_received', created_at FROM public.order_reviews
  UNION ALL
  SELECT freelancer_id, 'flexpro', 'gig_listed', created_at FROM public.gigs
  UNION ALL
  SELECT author_id, 'saltnpepper', 'discussion', created_at FROM public.discussions
  UNION ALL
  SELECT author_id, 'saltnpepper', 'discussion_reply', created_at FROM public.discussion_replies
  UNION ALL
  SELECT author_id, 'greymatters', 'post', created_at FROM public.posts WHERE author_id IS NOT NULL
  UNION ALL
  SELECT user_id, 'greymatters', 'comment', created_at FROM public.comments
  UNION ALL
  SELECT c.user_id, 'deepedge', 'application', a.applied_at FROM public.applications a JOIN public.candidates c ON c.id = a.candidate_id
  UNION ALL
  SELECT co.user_id, 'deepedge', 'job_posted', j.created_at FROM public.jobs j JOIN public.companies co ON co.id = j.company_id
) t
WHERE user_id = auth.uid();

GRANT SELECT ON public.my_pillar_activity TO authenticated;

CREATE OR REPLACE VIEW public.activity_feed AS
  SELECT
    'greymatters'::text AS pillar,
    'post'::text AS content_type,
    posts.id,
    posts.author_id,
    posts.title,
    posts.excerpt AS description,
    COALESCE(posts.published_at, posts.created_at) AS occurred_at,
    '/posts/' || posts.slug AS path,
    posts.feed_visibility
  FROM public.posts
  WHERE posts.status = 'published'
UNION ALL
  SELECT
    'saltnpepper'::text,
    'discussion'::text,
    discussions.id,
    CASE WHEN discussions.is_anonymous THEN NULL ELSE discussions.author_id END,
    discussions.title,
    discussions.body AS description,
    discussions.created_at AS occurred_at,
    '/discussions/' || discussions.id AS path,
    discussions.feed_visibility
  FROM public.discussions
UNION ALL
  SELECT
    'stackworks'::text,
    'project_update'::text,
    pu.id,
    pu.author_id,
    'Update on ' || bp.title AS title,
    pu.body AS description,
    pu.created_at AS occurred_at,
    '/projects/' || pu.project_id AS path,
    pu.feed_visibility
  FROM public.project_updates pu
  JOIN public.builder_projects bp ON bp.id = pu.project_id
UNION ALL
  SELECT
    'flexpro'::text,
    'gig'::text,
    gigs.id,
    gigs.freelancer_id,
    gigs.title,
    gigs.description,
    gigs.created_at AS occurred_at,
    '/gigs/' || gigs.id AS path,
    gigs.feed_visibility
  FROM public.gigs
  WHERE gigs.status = 'active'
UNION ALL
  SELECT
    'deepedge'::text,
    'job'::text,
    j.id,
    co.user_id,
    j.title,
    j.description,
    j.created_at AS occurred_at,
    '/jobs/' || j.id AS path,
    j.feed_visibility
  FROM public.jobs j
  JOIN public.companies co ON co.id = j.company_id
  WHERE j.status = 'open';

ALTER VIEW public.activity_feed SET (security_invoker = true);

-- ------------------------------------------------------------
-- 3. pillar_memberships CHECK constraint + its data -- drop, update,
-- re-add, same non-negotiable order 103/105 established.
-- ------------------------------------------------------------
ALTER TABLE public.pillar_memberships DROP CONSTRAINT pillar_memberships_pillar_check;
UPDATE public.pillar_memberships SET pillar = 'deepedge' WHERE pillar = 'greyin';
ALTER TABLE public.pillar_memberships ADD CONSTRAINT pillar_memberships_pillar_check
  CHECK (pillar = ANY (ARRAY['deepedge', 'greymatters', 'saltnpepper', 'flexpro', 'stackworks', 'longlist']));

-- No RLS policy has a literal pillar='greyin' condition (catalogued
-- and confirmed) and no llm_feature_flags row exists for this app --
-- nothing further to migrate.

COMMIT;

NOTIFY pgrst, 'reload schema';
