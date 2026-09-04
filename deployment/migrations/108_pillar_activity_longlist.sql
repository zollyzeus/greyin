-- ============================================================
-- my_pillar_activity: add Longlist as an activity source
-- ============================================================
-- Found via a direct user report ("dashboard not showing any activity
-- on longlist"). 046_pillar_activity_view.sql (and every later touch --
-- 047/053/103/105/106) only ever unioned deepedge/flexpro/stackworks/
-- saltnpepper/greymatters; Longlist launched later and was never added
-- as a source here, so a user's own future-role posts and future-
-- interested subscriptions have never shown up on the Hub dashboard's
-- "Activity across all six platforms" heatmap, structurally, not as a
-- rendering bug -- the row never existed to render.
--
-- Two real actions, matching the shape of the other pillars' own
-- entries: posting a future role (employer side), and subscribing to
-- one as future-interested (candidate side).
-- ============================================================

CREATE OR REPLACE VIEW public.my_pillar_activity AS
SELECT t.user_id, t.pillar, t.event_type, t.occurred_at
FROM (
  SELECT verified_outcomes.subject_user_id AS user_id, 'stackworks'::text AS pillar, 'verified_outcome'::text AS event_type, verified_outcomes.created_at AS occurred_at
  FROM verified_outcomes
  UNION ALL
  SELECT builder_projects.user_id, 'stackworks'::text, 'project_created'::text, builder_projects.created_at
  FROM builder_projects
  UNION ALL
  SELECT project_asks.created_by, 'stackworks'::text, 'ask_created'::text, project_asks.created_at
  FROM project_asks
  UNION ALL
  SELECT order_reviews.reviewee_id, 'flexpro'::text, 'review_received'::text, order_reviews.created_at
  FROM order_reviews
  UNION ALL
  SELECT gigs.freelancer_id, 'flexpro'::text, 'gig_listed'::text, gigs.created_at
  FROM gigs
  UNION ALL
  SELECT discussions.author_id, 'saltnpepper'::text, 'discussion'::text, discussions.created_at
  FROM discussions
  UNION ALL
  SELECT discussion_replies.author_id, 'saltnpepper'::text, 'discussion_reply'::text, discussion_replies.created_at
  FROM discussion_replies
  UNION ALL
  SELECT posts.author_id, 'greymatters'::text, 'post'::text, posts.created_at
  FROM posts
  WHERE posts.author_id IS NOT NULL
  UNION ALL
  SELECT comments.user_id, 'greymatters'::text, 'comment'::text, comments.created_at
  FROM comments
  UNION ALL
  SELECT c.user_id, 'deepedge'::text, 'application'::text, a.applied_at
  FROM applications a
  JOIN candidates c ON c.id = a.candidate_id
  UNION ALL
  SELECT co.user_id, 'deepedge'::text, 'job_posted'::text, j.created_at
  FROM jobs j
  JOIN companies co ON co.id = j.company_id
  UNION ALL
  SELECT future_roles.posted_by, 'longlist'::text, 'role_posted'::text, future_roles.created_at
  FROM future_roles
  UNION ALL
  SELECT future_role_subscriptions.user_id, 'longlist'::text, 'role_subscribed'::text, future_role_subscriptions.created_at
  FROM future_role_subscriptions
) t
WHERE t.user_id = auth.uid();
