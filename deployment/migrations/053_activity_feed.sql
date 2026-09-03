-- ============================================================
-- Activity feed: platform-wide follow graph + per-item feed
-- visibility + the cross-pillar feed view
-- ============================================================
--
-- Scope: feed CURATION only. feed_visibility governs whether a row is
-- distributed into a follower's /feed page. It does not change any
-- table's existing page-level SELECT RLS (view_audience on posts,
-- auth.role() = 'authenticated' on discussions/project_updates,
-- status-gated on gigs/jobs) -- a 'private' item is still reachable at
-- its normal URL exactly as before, just never pushed into anyone
-- else's feed.
--
-- feed_visibility is a new, distinctly-named column rather than
-- reusing posts.view_audience's existing 'follower' value (038) --
-- that value currently means "any authenticated user" (there was no
-- follow graph when it was written), and repointing it to mean real
-- followers would silently change behavior for already-published posts.
--
-- Run this after 052_newsletter_admin_select.sql
-- ============================================================

-- ------------------------------------------------------------
-- user_follows: one platform-wide follow graph (not per-pillar)
-- ------------------------------------------------------------
CREATE TABLE public.user_follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT user_follows_no_self_follow CHECK (follower_id <> followed_id)
);

-- follower_id is already the PK's leading column (fast "who do I
-- follow" lookups); followed_id needs its own index for "who follows
-- this person" / follower-count lookups.
CREATE INDEX idx_user_follows_followed_id ON public.user_follows(followed_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- The follow graph itself isn't sensitive -- same visibility posture as
-- discussions/project_updates ("anyone authenticated can view"). The
-- app also needs this to render a button's current state and to build
-- follower/following counts.
CREATE POLICY "Anyone authenticated can view the follow graph"
  ON public.user_follows FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can follow as themselves"
  ON public.user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow as themselves"
  ON public.user_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- No RPC needed here, unlike get_or_create_conversation (021): that RPC
-- exists because a conversation requires inserting TWO participant rows
-- atomically and returning a reusable id. A follow is a single row with
-- a natural composite PK -- INSERT/DELETE guarded by a plain WITH
-- CHECK/USING clause is sufficient; a duplicate-follow INSERT just hits
-- the PK's unique-violation (23505), which the create route treats
-- as an idempotent success rather than an error.

-- ------------------------------------------------------------
-- feed_visibility: per-item opt-in/out of FEED distribution only.
-- ------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS feed_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (feed_visibility IN ('public', 'followers', 'private'));

ALTER TABLE public.discussions
  ADD COLUMN IF NOT EXISTS feed_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (feed_visibility IN ('public', 'followers', 'private'));

ALTER TABLE public.project_updates
  ADD COLUMN IF NOT EXISTS feed_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (feed_visibility IN ('public', 'followers', 'private'));

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS feed_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (feed_visibility IN ('public', 'followers', 'private'));

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS feed_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (feed_visibility IN ('public', 'followers', 'private'));

-- project_updates never got an UPDATE policy (030 only gave it
-- SELECT/INSERT/admin-DELETE) -- without this, an author could set
-- feed_visibility at creation time but never change it afterward,
-- breaking the self-dashboard's inline visibility control. Scoped
-- identically to the existing INSERT policy: only the update's own
-- author may change it.
CREATE POLICY "Project owners can update their own project updates"
  ON public.project_updates FOR UPDATE
  USING (auth.uid() = author_id);

-- posts/discussions/gigs/jobs already have author-owned UPDATE
-- policies (001/030-era/001/001 respectively) that cover this column
-- change with no further migration needed.

-- ------------------------------------------------------------
-- activity_feed: cross-pillar UNION ALL view, same convention as
-- platform_search_index (037) and my_pillar_activity (046) --
-- unfiltered inside the view, security comes entirely from each
-- UNIONed table's own existing RLS still applying per-invoker. The app
-- does its own two-step query (fetch followed_ids, then .in() this
-- view, excluding feed_visibility = 'private').
-- ------------------------------------------------------------
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
  -- author_id is NULLed for anonymous discussions *in the view itself*,
  -- not just hidden client-side -- it structurally cannot match a
  -- follower's .in(followedIds) filter, so an anonymous discussion can
  -- never appear in anyone's followers' feed. The discussion page
  -- itself is unaffected (unchanged, queries discussions directly;
  -- is_anonymous still only controls the displayed name there).
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
  -- project_updates has no title of its own -- borrow the parent
  -- project's title, and link to the project page (no standalone
  -- update route exists; updates render inline under /projects/[id]).
  SELECT
    'stackedge'::text,
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
    'freeagent'::text,
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
  -- jobs has no direct owner column -- resolve via companies, same
  -- join my_pillar_activity (046) already uses. Pillar tag 'greyin'
  -- matches every app's own EcosystemSearchResults.tsx PILLAR_DOMAINS
  -- lookup (not 'expertedge', which is what my_pillar_activity
  -- inconsistently uses instead) -- following the app-facing
  -- convention, not introducing a second inconsistency.
  SELECT
    'greyin'::text,
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

-- Logged-in-only feature (a follow list requires a session) -- unlike
-- platform_search_index/greyin_scores which grant anon too.
GRANT SELECT ON public.activity_feed TO authenticated;

NOTIFY pgrst, 'reload schema';
