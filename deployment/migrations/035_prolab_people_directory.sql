-- ============================================================
-- Fix: nobody but yourself could read pillar_memberships
-- ============================================================
--
-- 022's only SELECT policy on pillar_memberships is self-only
-- (auth.uid() = user_id) -- fine for its original use (EcosystemWidget
-- reading your own active pillars), but the new /people directory needs
-- to list *other* users' prolab membership to know who to show at all.
-- Scoped narrowly to pillar='prolab' so greyin/greymatters/saltnpepper/
-- freeagent memberships keep their existing self-only privacy; matches
-- the same `auth.role() = 'authenticated'` bar builder_projects/
-- project_asks already use for their own "public-ish" listings.
--
-- Run this after 034_verification_admin_select.sql
-- ============================================================

CREATE POLICY "Anyone authenticated can view prolab pillar memberships"
  ON public.pillar_memberships FOR SELECT
  USING (auth.role() = 'authenticated' AND pillar = 'prolab');

NOTIFY pgrst, 'reload schema';
