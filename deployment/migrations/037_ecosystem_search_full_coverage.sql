-- ============================================================
-- Ecosystem Search: add the two pillars it was missing
-- ============================================================
--
-- platform_search_index (introduced before prolab/saltnpepper's
-- discussions feature existed in their current form) only ever unioned
-- jobs/gigs/posts -- Salt & Pepper discussions and Prolab projects were
-- never added, despite every app's nav linking to this as "Ecosystem
-- Search." Redefining the view to add both.
--
-- Run this after 036_unified_greyin_score.sql
-- ============================================================

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
    'prolab'::text AS pillar,
    builder_projects.id,
    builder_projects.title,
    builder_projects.description,
    '/projects/'::text || builder_projects.id AS path,
    builder_projects.created_at
  FROM builder_projects;

NOTIFY pgrst, 'reload schema';
