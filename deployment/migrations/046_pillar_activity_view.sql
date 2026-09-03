-- ============================================================
-- Cross-pillar activity view -- feeds the ecosystem hub's personal
-- activity calendar (greyin.net/dashboard), nothing else
-- ============================================================
--
-- Same aggregation convention as 036's greyin_scores and 037's
-- platform_search_index (a UNION ALL view over each pillar's own
-- timestamped tables), but privacy-scoped to the caller: this exposes
-- day-level personal activity, not a public score or a searchable
-- listing, so the self-filter is baked into the view itself (not just
-- app-side query discipline) via `WHERE user_id = auth.uid()` -- this
-- is safe regardless of view-owner-vs-invoker semantics, since auth.uid()
-- reads the calling request's JWT, not anything ownership-dependent.
-- Granted to authenticated only, not anon, unlike greyin_scores.
--
-- Deliberately excludes reputation_events -- it would double-count the
-- same underlying action already captured via discussions/
-- discussion_replies (reputation is the derived scoring artifact of
-- those actions, not a distinct activity of its own).
--
-- greyin_scores (036/038/041) is not touched by this migration -- the
-- scoring algorithm stays exactly as-is.
-- ============================================================

CREATE OR REPLACE VIEW public.my_pillar_activity AS
SELECT * FROM (
  SELECT subject_user_id AS user_id, 'prolab' AS pillar, 'verified_outcome' AS event_type, created_at AS occurred_at FROM public.verified_outcomes
  UNION ALL
  SELECT user_id, 'prolab', 'project_created', created_at FROM public.builder_projects
  UNION ALL
  SELECT created_by, 'prolab', 'ask_created', created_at FROM public.project_asks
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

NOTIFY pgrst, 'reload schema';
