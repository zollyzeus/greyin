-- ============================================================
-- List A resolution (code-vs-database integrity audit, 2026-09-04):
-- add the 3 profile fields worth keeping as real columns.
-- ============================================================
--
-- Salt & Pepper's "interests" (free-text, comma-separated) and FlexPro's
-- "title"/"languages" were all being silently dropped by PostgREST
-- rejecting the whole profile-save .update() on an unknown column.
-- Confirmed none of the three are read anywhere yet (no directory
-- filter, no public display, no matching) -- adding the columns now so
-- profile-save stops failing; wiring up display/matching is separate,
-- future work.
--
-- FlexPro's own "title" is deliberately its own generic column, not a
-- reuse of candidates.current_title -- that column is DeepEdge-specific
-- (a candidate's current EMPLOYER job title), a different concept from
-- a FlexPro freelancer's own service/professional title.
--
-- The other broken fields in the same audit (email_notifications/
-- show_email/comment_notifications on GreyMatters+Salt & Pepper,
-- FlexPro's skills/razorpay_account_id) are NOT added here -- dropped
-- from the app code instead (dead notification flags with no consuming
-- logic anywhere; skills redirected to the existing platform-wide
-- profile_skills table; razorpay_account_id superseded by the real
-- payout_requests bank-detail flow).
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}'::text[];
