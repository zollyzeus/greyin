-- ============================================================
-- Platform-wide search (cross-pillar discovery)
-- ============================================================
--
-- Deliberately excludes Salt & Pepper discussions and Lab projects, even
-- though they're structurally easy to union in — that content is gated to
-- authenticated community members ("private, age-verified peer community"
-- per the business plan), and a public search index bypassing that via a
-- SECURITY DEFINER-style view would leak it to anonymous visitors. This
-- covers only what's already publicly viewable: published posts, open
-- jobs, active gigs.
-- ============================================================

CREATE VIEW public.platform_search_index AS
SELECT
  'post'::text AS type,
  'greymatters'::text AS pillar,
  id,
  title,
  excerpt AS description,
  '/posts/' || slug AS path,
  created_at
FROM public.posts
WHERE status = 'published'

UNION ALL

SELECT
  'job'::text AS type,
  'greyin'::text AS pillar,
  id,
  title,
  description,
  '/jobs/' || id AS path,
  created_at
FROM public.jobs
WHERE status = 'open'

UNION ALL

SELECT
  'gig'::text AS type,
  'freeagent'::text AS pillar,
  id,
  title,
  description,
  '/gigs/' || id AS path,
  created_at
FROM public.gigs
WHERE status = 'active';

GRANT SELECT ON public.platform_search_index TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
