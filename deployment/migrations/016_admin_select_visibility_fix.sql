-- ============================================================
-- Fix: admin UPDATE actions that change status silently failed
-- ============================================================
--
-- Discovered via e2e testing: an admin closing a job (status -> 'closed')
-- or a gig (status -> 'closed') or unpublishing a post (status -> 'archived')
-- all failed with "new row violates row-level security policy" even though
-- 015's admin UPDATE policies were in place and correct.
--
-- Root cause: PostgREST always performs UPDATE ... RETURNING internally.
-- Under RLS, the *new* row must remain visible under at least one SELECT
-- policy for RETURNING to succeed. jobs/gigs/posts only had SELECT policies
-- scoped to "publicly visible status" (open/filled, active, published) or
-- "the owner's own rows" — an admin who isn't the owner loses all SELECT
-- visibility into the row the instant its status changes away from public,
-- so the RETURNING step (and thus the whole UPDATE) gets rejected.
--
-- This is exactly the pattern the original schema avoided for `comments`
-- by only ever using DELETE for admin moderation there (no matching gap).
-- Fix: give admins their own unconditional SELECT policy, same pattern as
-- the UPDATE policies added in 015.
-- ============================================================

CREATE POLICY "Admins can view all jobs"
  ON public.jobs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view all gigs"
  ON public.gigs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view all posts"
  ON public.posts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

NOTIFY pgrst, 'reload schema';
