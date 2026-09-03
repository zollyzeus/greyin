-- ============================================================
-- Gap-audit item #1: pre-publish Salt & Pepper content moderation.
-- See apps/saltnpepper-community/src/lib/moderation.ts for the full
-- state machine. Depends on 097-adjacent Phase 0 (LLM client timeout
-- fix, already applied in code, no migration of its own).
-- ============================================================

-- 'passed': the normal case (checked live, ALLOW; or re-checked after a
-- prior pending_check and cleared). 'pending_check': the LLM was
-- unreachable/unconfigured at post time -- fail-open let the post
-- through, queued for automatic retry. 'flagged_on_retry': a retry
-- later returned BLOCK -- surfaced for admin review, never
-- auto-deleted. A live BLOCK verdict at post time is never inserted at
-- all, so there's no 'blocked' status to represent here.
ALTER TABLE public.discussions
  ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'passed'
    CHECK (moderation_status IN ('passed', 'pending_check', 'flagged_on_retry'));

ALTER TABLE public.discussion_replies
  ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'passed'
    CHECK (moderation_status IN ('passed', 'pending_check', 'flagged_on_retry'));

CREATE INDEX idx_discussions_moderation_pending ON public.discussions(moderation_status) WHERE moderation_status <> 'passed';
CREATE INDEX idx_discussion_replies_moderation_pending ON public.discussion_replies(moderation_status) WHERE moderation_status <> 'passed';

-- Retry every 15 minutes when there's a backlog -- runPeriodicModerationRetryIfDue
-- is a no-op otherwise (NULL interval skips it, same convention as
-- saltnpepper_reply_quality's own row).
INSERT INTO public.llm_feature_flags (feature_key, enabled, sweep_interval_minutes)
VALUES ('saltnpepper_moderation', true, 15)
ON CONFLICT (feature_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
