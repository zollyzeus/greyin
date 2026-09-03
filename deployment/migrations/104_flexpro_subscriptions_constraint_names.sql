-- ============================================================
-- App 1 Tier 3 follow-up: rename flexpro_subscriptions' constraints
-- ============================================================
--
-- 103 renamed the freeagent_subscriptions table itself (ALTER TABLE
-- ... RENAME TO), but Postgres does not rename a table's own
-- auto-generated constraint/index names along with it -- they stayed
-- on the old freeagent_subscriptions_* prefix. Purely cosmetic (no
-- behavior change -- these are internal identifiers, never read by
-- app code or PostgREST's routing), applied as its own migration
-- since 103 was already run and committed by the time this was
-- noticed (matching this repo's own convention of never retroactively
-- editing an already-applied migration file).
--
-- Also worth recording here: after 103 ran, POST/on_conflict requests
-- to flexpro_subscriptions returned a bare 404 from PostgREST even
-- though GET already worked -- NOTIFY pgrst, 'reload schema' refreshed
-- read-routing but not write-routing for the renamed table. Fixed by
-- `docker service update --force supabase_rest` (a real PostgREST
-- restart, not just the NOTIFY). Worth doing that proactively on any
-- future migration that renames a table, not just after finding it
-- broken.
--
-- Run this after 103_flexpro_rename.sql
-- ============================================================

ALTER TABLE public.flexpro_subscriptions RENAME CONSTRAINT freeagent_subscriptions_activated_by_fkey TO flexpro_subscriptions_activated_by_fkey;
ALTER TABLE public.flexpro_subscriptions RENAME CONSTRAINT freeagent_subscriptions_pkey TO flexpro_subscriptions_pkey;
ALTER TABLE public.flexpro_subscriptions RENAME CONSTRAINT freeagent_subscriptions_plan_id_fkey TO flexpro_subscriptions_plan_id_fkey;
ALTER TABLE public.flexpro_subscriptions RENAME CONSTRAINT freeagent_subscriptions_status_check TO flexpro_subscriptions_status_check;
ALTER TABLE public.flexpro_subscriptions RENAME CONSTRAINT freeagent_subscriptions_tier_id_fkey TO flexpro_subscriptions_tier_id_fkey;
ALTER TABLE public.flexpro_subscriptions RENAME CONSTRAINT freeagent_subscriptions_user_id_fkey TO flexpro_subscriptions_user_id_fkey;
ALTER TABLE public.flexpro_subscriptions RENAME CONSTRAINT freeagent_subscriptions_user_id_key TO flexpro_subscriptions_user_id_key;

NOTIFY pgrst, 'reload schema';
