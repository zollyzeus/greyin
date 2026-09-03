-- ============================================================
-- Gate posting a gig listing behind an active FreeAgent subscription
-- ============================================================
--
-- 093 added the subscription gate to client_jobs' own INSERT policy,
-- but gigs' pre-existing "Freelancers can insert gigs" policy (from
-- before 093) was never touched -- posting a gig as a freelancer was
-- still free. Same gate, same table this policy already existed on;
-- replacing rather than adding a second policy since a permissive
-- second INSERT policy would just OR with the old one and defeat the
-- point.
--
-- Run this after 093_freeagent_client_jobs_and_subscriptions.sql
-- ============================================================

DROP POLICY IF EXISTS "Freelancers can insert gigs" ON public.gigs;

CREATE POLICY "An active subscriber can post a gig listing"
  ON public.gigs FOR INSERT
  WITH CHECK (
    auth.uid() = freelancer_id
    AND EXISTS (SELECT 1 FROM public.freeagent_subscriptions WHERE user_id = auth.uid() AND status = 'active')
  );

NOTIFY pgrst, 'reload schema';
