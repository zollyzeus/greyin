-- ============================================================
-- SEC-025 (2026-08-26 security audit): subscription_plans is the only
-- CREATE TABLE public.* across every migration missing
-- ENABLE ROW LEVEL SECURITY. This turned out to be far more serious
-- than the original finding's "MEDIUM" rating assumed: this instance's
-- schema-wide default grants give anon and authenticated real
-- INSERT/UPDATE/DELETE/TRUNCATE privileges on every public table
-- (confirmed via information_schema.role_table_grants -- not just the
-- SELECT the migration's own explicit GRANT line implied), and with RLS
-- disabled those grants are the ONLY gate. In practice, any
-- unauthenticated visitor could directly PATCH/DELETE the platform's
-- real pricing rows via PostgREST -- not a hypothetical, an active gap.
--
-- Run this after 077_fix_referral_notification_authz.sql
-- ============================================================

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Public pricing page needs anon+authenticated read access -- this was
-- already the intent of the table's own GRANT SELECT line, just never
-- backed by RLS. No write policies at all: plan changes go through
-- service_role only (there is no user-facing "edit pricing" flow
-- anywhere in the app), matching the no-direct-grants convention used
-- for rate_limit_attempts (075) and similar tables.
CREATE POLICY "Subscription plans are publicly readable"
  ON public.subscription_plans FOR SELECT
  USING (true);

NOTIFY pgrst, 'reload schema';
