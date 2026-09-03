-- ============================================================
-- Fix: future_role_subscriptions' own INSERT check couldn't pass for
-- anyone but the role's owner.
--
-- Found by direct RLS verification (SET LOCAL role authenticated +
-- request.jwt.claims, same technique as every other RLS check this
-- project does before shipping): 087's WITH CHECK queried the base
-- future_roles table to confirm the role was still 'open' --
-- `future_role_id IN (SELECT id FROM future_roles WHERE status='open')`.
-- That subquery is itself subject to future_roles' own RLS ("Employer
-- manages own future roles", owner-only), so for a real member's
-- session it always evaluates against an empty set regardless of the
-- role's actual status -- even subscribing to your own future-interest
-- was unconditionally rejected. Point the check at future_roles_public
-- instead, the view members can actually read.
--
-- Run this after 087_longlist_future_roles.sql
-- ============================================================

DROP POLICY "Member manages own subscription" ON public.future_role_subscriptions;

CREATE POLICY "Member manages own subscription" ON public.future_role_subscriptions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND future_role_id IN (SELECT id FROM public.future_roles_public)
  );

NOTIFY pgrst, 'reload schema';
