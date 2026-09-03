-- ============================================================
-- Peer rating anonymity (real RLS, not just app convention) +
-- employer-facing rater reliability (quid-pro-quo detection)
-- ============================================================
--
-- 089's original peer_project_ratings SELECT policy was USING(true),
-- following company_reviews' (058) "anonymity is an app-layer
-- convention, not access control" precedent. That's not strong enough
-- here: the requirement is that individual rater->ratee rows are
-- genuinely inaccessible to a regular member, not just hidden by
-- app code that happens not to select rater_id -- anyone could query
-- PostgREST directly (?rater_id=eq.X) otherwise. Tightened below.
--
-- The ratee's own peer_score (greyin_scores, 089) is unaffected by
-- this tightening: that view is owned by postgres and computes its
-- aggregate directly off the base table, which bypasses RLS for the
-- table owner by default (same mechanism every other *_raw CTE in
-- that view already relies on -- verified_outcomes/reputation_events
-- aren't public tables either).
--
-- peer_rater_reliability is new: an employer/admin-only aggregate of
-- what a given person hands out as a RATER (not what they receive) --
-- average rating given, % that are the top score, and specifically a
-- reciprocity metric: what share of their given ratings are part of a
-- mutual pair where BOTH sides rated each other >=4. A rater who
-- reliably trades top ratings back and forth with the same people is
-- the actual quid-pro-quo signal this surfaces; a single high rating
-- given to one real collaborator is not. Gated by auth.uid() directly
-- in the view's own WHERE clause (not relying on base-table RLS,
-- since peer_project_ratings' own rows are no longer broadly
-- readable) -- deliberately platform-wide for any employer, not
-- scoped to "employers of that specific person": there's no clean
-- per-company scoping the way company_reviews has (a rater's pattern
-- is relevant to any employer evaluating them, not just one company).
--
-- Run this after 089_peer_projects.sql
-- ============================================================

DROP POLICY IF EXISTS "Peer project ratings are viewable by everyone" ON public.peer_project_ratings;

CREATE POLICY "Ratings are visible to the rater themself or to employers/admin"
  ON public.peer_project_ratings FOR SELECT
  USING (
    auth.uid() = rater_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('employer', 'admin'))
  );

CREATE OR REPLACE VIEW public.peer_rater_reliability AS
WITH given AS (
  SELECT rater_id, ratee_id, project_id, contribution_rating FROM public.peer_project_ratings
),
mutual AS (
  -- Both directions of the same project's pair exist -- g1 is "this
  -- rater rated someone", g2 is "that same someone rated this rater
  -- back", scoped to the same project so an unrelated rating pair
  -- elsewhere never counts as reciprocity here.
  SELECT g1.rater_id, g1.contribution_rating AS given_rating, g2.contribution_rating AS received_rating
  FROM given g1
  JOIN given g2 ON g1.project_id = g2.project_id AND g1.rater_id = g2.ratee_id AND g1.ratee_id = g2.rater_id
),
per_rater AS (
  SELECT
    rater_id,
    COUNT(*) AS ratings_given_count,
    ROUND(AVG(contribution_rating)::numeric, 2) AS avg_rating_given,
    COUNT(*) FILTER (WHERE contribution_rating = 5) AS top_rating_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE contribution_rating = 5) / COUNT(*), 1) AS top_rating_pct
  FROM given
  GROUP BY rater_id
),
per_rater_reciprocity AS (
  SELECT
    rater_id,
    COUNT(*) AS mutual_pair_count,
    COUNT(*) FILTER (WHERE given_rating >= 4 AND received_rating >= 4) AS mutual_high_rating_count
  FROM mutual
  GROUP BY rater_id
)
SELECT
  pr.rater_id,
  p.full_name AS rater_name,
  pr.ratings_given_count,
  pr.avg_rating_given,
  pr.top_rating_count,
  pr.top_rating_pct,
  COALESCE(prr.mutual_pair_count, 0) AS mutual_pair_count,
  COALESCE(prr.mutual_high_rating_count, 0) AS mutual_high_rating_count,
  ROUND(100.0 * COALESCE(prr.mutual_high_rating_count, 0) / NULLIF(pr.ratings_given_count, 0), 1) AS mutual_high_rating_pct
FROM per_rater pr
JOIN public.profiles p ON p.id = pr.rater_id
LEFT JOIN per_rater_reciprocity prr ON prr.rater_id = pr.rater_id
WHERE EXISTS (
  SELECT 1 FROM public.profiles v WHERE v.id = auth.uid() AND v.role IN ('employer', 'admin')
);

GRANT SELECT ON public.peer_rater_reliability TO authenticated;

NOTIFY pgrst, 'reload schema';
