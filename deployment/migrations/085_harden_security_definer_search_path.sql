-- ============================================================
-- SEC-034 (2026-08-26 security audit): SECURITY DEFINER functions
-- without an explicit SET search_path are searched using the calling
-- session's search_path, which a malicious caller who can create
-- objects in a schema earlier in their own search_path could exploit
-- to shadow an unqualified function/table reference inside the
-- SECURITY DEFINER function's body, running attacker code with the
-- function owner's privileges. Low real exploitability on this managed
-- Supabase-style instance (schema-creation privileges are not
-- available to anon/authenticated), but this is the standard, cheap,
-- zero-behavior-change hardening for it regardless. 44 of 59 current
-- SECURITY DEFINER functions already had search_path set (most of
-- them incidentally, from functions written or touched during this
-- same audit) -- this closes the remaining 15.
--
-- ALTER FUNCTION ... SET search_path only changes the function's own
-- configuration, not its body -- zero behavior change for any
-- legitimate caller.
--
-- Run this after 084_fix_payout_amount_check.sql
-- ============================================================

ALTER FUNCTION public.capture_razorpay_payment(uuid, text, text, text) SET search_path = public;
ALTER FUNCTION public.create_razorpay_order(uuid, text) SET search_path = public;
ALTER FUNCTION public.finalize_expired_verified_outcomes() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.is_candidate(uuid) SET search_path = public;
ALTER FUNCTION public.is_job_owner(uuid) SET search_path = public;
ALTER FUNCTION public.is_order_buyer(uuid) SET search_path = public;
ALTER FUNCTION public.is_order_seller(uuid) SET search_path = public;
ALTER FUNCTION public.process_razorpay_refund(uuid, text, integer) SET search_path = public;
ALTER FUNCTION public.update_discussion_reply_count() SET search_path = public;
ALTER FUNCTION public.update_gig_review_stats() SET search_path = public;
ALTER FUNCTION public.update_order_message_stats() SET search_path = public;
ALTER FUNCTION public.update_project_upvote_count() SET search_path = public;
ALTER FUNCTION public.update_seller_review_stats() SET search_path = public;

NOTIFY pgrst, 'reload schema';
