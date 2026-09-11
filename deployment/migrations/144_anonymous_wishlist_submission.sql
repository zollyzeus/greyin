-- ============================================================
-- Anonymous wishlist submission (Emergent-parity gap #2, part 1 of 2)
-- ============================================================
--
-- 101's own migration comment records this as a DELIBERATE decision
-- made with the user at the time: "feedback requires login, no
-- anonymous submission." This migration explicitly REVERSES that
-- decision, per the user's current, explicit request to match a
-- competitor reference (Emergent's /wishlist/public) -- not a bug fix,
-- a considered policy change, recorded here for the same reason the
-- original decision was recorded.
--
-- Also widens the SELECT policy to public (USING (true)): confirmed
-- the current "authenticated only" SELECT policy means an anonymous
-- visitor who just submitted anonymously would immediately see an
-- empty list on the same /wishlist page they were redirected back to
-- (RLS hides every row, including their own, from an anon reader) --
-- nothing in title/description/status/upvote_count is sensitive, and a
-- wishlist an anonymous submitter can't even see afterward isn't a
-- coherent version of the feature Emergent has. Upvoting stays
-- authenticated-only and unchanged -- only submission visibility was
-- the actual gap.
--
-- Run this after 143_admin_transaction_ledger.sql
-- ============================================================

ALTER TABLE public.feature_requests ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.feature_requests ADD COLUMN email TEXT;
ALTER TABLE public.feature_requests ADD CONSTRAINT feature_requests_submitter_check
  CHECK (user_id IS NOT NULL OR email IS NOT NULL);

DROP POLICY "Anyone authenticated can view feature requests" ON public.feature_requests;
CREATE POLICY "Feature requests are publicly readable"
  ON public.feature_requests FOR SELECT
  USING (true);

DROP POLICY "Members can submit feature requests" ON public.feature_requests;
CREATE POLICY "Anyone can submit a feature request, members as themselves"
  ON public.feature_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Public, unauthenticated writes need rate limiting like every other one
-- added this session (075's mechanism, widened for 'demo_login' in 137;
-- this is the second reuse) -- a spam feature-request flood is a real,
-- visible admin annoyance.
ALTER TABLE public.rate_limit_attempts DROP CONSTRAINT rate_limit_attempts_action_check;
ALTER TABLE public.rate_limit_attempts ADD CONSTRAINT rate_limit_attempts_action_check
  CHECK (action = ANY (ARRAY['password_reset', 'signup', 'demo_login', 'wishlist_anonymous']));

NOTIFY pgrst, 'reload schema';
