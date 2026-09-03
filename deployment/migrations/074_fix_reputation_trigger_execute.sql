-- ============================================================
-- Fix a real regression from 067's award_reputation() REVOKE
-- ============================================================
--
-- 067 revoked PUBLIC/anon/authenticated EXECUTE on award_reputation()
-- to close SEC-007 (any caller could mint arbitrary reputation by
-- invoking the RPC directly via PostgREST with attacker-controlled
-- parameters). The audit note that it's "only ever invoked internally
-- via PERFORM from other trigger functions" was correct, but missed
-- that NONE of those four trigger functions (025_reputation.sql) are
-- themselves SECURITY DEFINER -- they run with the triggering user's
-- own (invoker) privileges, which the REVOKE also stripped. Broke
-- discussion/reply/project creation and project upvotes platform-wide
-- (Salt & Pepper, StackEdge) with "permission denied for function
-- award_reputation" -- caught via direct SQL simulation of a real
-- project-creation insert, tracing why verification.spec.ts's "Post
-- Project" flow was silently failing.
--
-- The fix is not to re-grant broad EXECUTE (that reopens SEC-007
-- entirely) -- it's to make these four trigger functions SECURITY
-- DEFINER, matching every other trusted-internal-trigger pattern
-- already used throughout this schema (handle_email_confirmed,
-- notify_new_written_recommendation, etc.). A SECURITY DEFINER
-- function's owner (postgres, same as every migration-created object)
-- always retains implicit EXECUTE on objects it owns regardless of a
-- REVOKE targeting other roles -- so these keep working, while a
-- direct /rpc/award_reputation call from an authenticated session
-- (SEC-007's actual exploit) stays blocked.
--
-- Run this after 073_fix_gig_order_refund_transitions.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.reputation_on_discussion_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM award_reputation(NEW.author_id, 'discussion_created', 1, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reputation_on_reply_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM award_reputation(NEW.author_id, 'reply_given', 1, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reputation_on_project_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM award_reputation(NEW.user_id, 'project_created', 1, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reputation_on_project_upvoted()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT user_id INTO v_owner_id FROM builder_projects WHERE id = NEW.project_id;
  IF v_owner_id IS NOT NULL THEN
    PERFORM award_reputation(v_owner_id, 'project_upvoted', 2, NEW.project_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
