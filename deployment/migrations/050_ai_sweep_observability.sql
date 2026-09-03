-- ============================================================
-- AI quality scoring: admin observability + admin-configurable
-- periodic sweep interval
-- ============================================================
--
-- The page-visit-triggered sweeps added alongside 048/049
-- (sweepUnscoredPosts on GreyMatters' /dashboard, sweepUnscoredReplies
-- globally on Salt & Pepper's /dashboard) only run when someone actually
-- visits those pages -- there was no way to see whether a backlog was
-- accumulating, and no way to make progress during a quiet stretch with
-- no visits at all.
--
-- This adds two columns to the existing llm_feature_flags row for each
-- sweeping pillar (not a new table -- these are properties of the same
-- feature, editable from the same admin panel that already manages
-- everything else about it):
--
-- - sweep_interval_minutes: NULL (default) means no periodic sweep runs
--   -- only the page-visit-triggered catch-up. Admin-set to a number to
--   enable a background timer (see each app's src/instrumentation.ts)
--   that sweeps on a schedule regardless of traffic.
-- - last_swept_at: written by the periodic timer each time it actually
--   runs (not every tick) -- used to decide when the next run is due.
--   NOT written by the page-visit-triggered sweeps, which are a
--   different, complementary mechanism (fast feedback while browsing);
--   conflating the two would make the "is the periodic timer actually
--   running" signal meaningless.
--
-- Run this after 049_e2e_admin_panel_test_flag.sql
-- ============================================================

ALTER TABLE public.llm_feature_flags
  ADD COLUMN IF NOT EXISTS sweep_interval_minutes INT,
  ADD COLUMN IF NOT EXISTS last_swept_at TIMESTAMPTZ;

COMMENT ON COLUMN public.llm_feature_flags.sweep_interval_minutes IS
  'How often the background sweep for missed content (posts/replies that never went through their direct scoring hook) should run, in minutes. NULL = periodic sweep disabled -- only the page-visit-triggered catch-up runs.';

COMMENT ON COLUMN public.llm_feature_flags.last_swept_at IS
  'Set by the periodic sweep timer each time it actually runs a sweep (not on every timer tick). Used to decide whether the next scheduled run is due yet. Not touched by the page-visit-triggered catch-up sweeps.';

NOTIFY pgrst, 'reload schema';
