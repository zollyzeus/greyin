-- ============================================================
-- Fix a real FK gap: future_roles.posted_by had no ON DELETE action
-- ============================================================
--
-- Found live, 2026-09-08, while e2e-testing the new Longlist admin tab
-- (Phase 3, pitch-readiness plan): deleting an employer test account
-- that had posted a future role failed with a 500
-- ("future_roles_posted_by_fkey... still referenced"), since
-- future_roles.posted_by REFERENCES auth.users(id) with no CASCADE/SET
-- NULL of its own (087_longlist_future_roles.sql) -- Postgres checks
-- every FK referencing a deleted row directly, not just the one reached
-- via future_roles.company_id's own (correct) ON DELETE CASCADE, so
-- that other cascade path completing first doesn't save this one.
--
-- This isn't just a test-cleanup problem -- any real employer account
-- deletion with a posted future role would hit the same failure in
-- production. CASCADE is the right behavior here, matching
-- company_id's own semantics: a future role is the posting employer's
-- own data, and RLS already requires posted_by = auth.uid() AND
-- company ownership together (087's "Employer manages own future
-- roles" policy) -- the two columns always describe the same account,
-- so they should have the same delete behavior.
--
-- Run this after 141_admin_overview_aggregate_counts.sql
-- ============================================================

ALTER TABLE public.future_roles DROP CONSTRAINT future_roles_posted_by_fkey;
ALTER TABLE public.future_roles ADD CONSTRAINT future_roles_posted_by_fkey
  FOREIGN KEY (posted_by) REFERENCES auth.users(id) ON DELETE CASCADE;
