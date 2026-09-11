-- ============================================================
-- Admin RLS bypass for Longlist's future_roles/future_role_subscriptions
-- ============================================================
--
-- Longlist has no admin page at all today (confirmed via a fresh audit,
-- 2026-09-08) -- and unlike every other pillar's core tables, neither
-- future_roles nor future_role_subscriptions has ever had an admin-role
-- bypass policy (087/088 only grant the posting employer and the
-- subscribing member their own-row access). Building Longlist's admin
-- tab (Phase 3, pitch-readiness plan) needs one, matching the exact
-- EXISTS(...role='admin') convention used everywhere else on this
-- platform (e.g. jobs/gigs/discussions), not a service-role bypass in
-- the route -- keeps this table consistent with how every other admin
-- capability on the platform is actually authorized.
--
-- Run this after 139_post_reactions.sql
-- ============================================================

CREATE POLICY "Admins manage all future roles" ON public.future_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins see all future role subscriptions" ON public.future_role_subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
