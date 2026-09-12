-- ============================================================
-- "Report this" (receiver-side) + user blocking
-- ============================================================
--
-- Follow-up to a platform-wide abuse-vector audit (2026-09-13): no
-- member-facing "Report" action existed ANYWHERE on the platform --
-- only automatic/system checks (Salt & Pepper's pre-publish moderation
-- LLM, StackWorks' peer-rating reciprocity flags, GreyMatters' post
-- authenticity flag). None of those let a RECEIVER flag something a
-- POSTER put in front of them. Of everything the audit found, three
-- gaps had a real, non-theoretical path to harm and no existing
-- consent-gate/attribution/automated-check already blunting them:
--   1. DeepEdge company_reviews -- anonymous poster (reviewer_id has no
--      SELECT grant at all, 067) + real company reputation at stake +
--      zero admin discoverability (no admin UI lists these at all today).
--   2. Direct messages (shared schema, DeepEdge + Salt & Pepper) -- a
--      1:1 harassment vector with no report OR block mechanism.
--   3. GreyMatters comments -- readers fully exposed to other readers'
--      comments; a `status` column (approved|pending|spam) has existed
--      since 001_initial_schema.sql but nothing has ever set it to
--      anything but 'approved' at insert -- half-built plumbing.
-- Everything else the audit found (job postings, gigs, FlexPro reviews,
-- StackWorks asks, events, peer-project tags, written recommendations)
-- already has a consent gate, real attribution, an existing automated
-- reciprocity/quality check, or low enough stakes that a report button
-- wasn't built for it now -- see the audit writeup for the full
-- per-pillar reasoning.
--
-- content_reports is ONE shared table (not three per-pillar ones) --
-- same reasoning as notifications/direct_messages: one Supabase project
-- backs every app, and "a member reports a piece of content" is the
-- exact same shape regardless of what the content is. All writes go
-- through submit_content_report() (SECURITY DEFINER) rather than a
-- direct INSERT policy, both to validate content_type and to page every
-- admin through the existing notifications table/bell in the same
-- transaction -- previously the ONE real gap in the "moderation queue"
-- pattern Salt & Pepper's own review queue never had either: an admin
-- had to proactively check each /admin/* page, with no push alert for
-- anything, ever.
-- ============================================================

CREATE TABLE public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('company_review', 'direct_message', 'greymatters_comment')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_content_reports_status ON public.content_reports(status, created_at DESC);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporters can view their own reports"
  ON public.content_reports FOR SELECT
  USING (reporter_id = auth.uid());

CREATE POLICY "Admins can view all reports"
  ON public.content_reports FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update reports"
  ON public.content_reports FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- No direct INSERT policy for anyone -- submit_content_report() is the
-- only write path, same "RPC is the real gate" convention as
-- consume_credit()/vote_discussion().
CREATE OR REPLACE FUNCTION public.submit_content_report(p_content_type TEXT, p_content_id UUID, p_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_report_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_content_type NOT IN ('company_review', 'direct_message', 'greymatters_comment') THEN
    RAISE EXCEPTION 'Invalid content_type';
  END IF;
  IF trim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;

  INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason)
  VALUES (auth.uid(), p_content_type, p_content_id, p_reason)
  RETURNING id INTO v_report_id;

  -- Soft-hide a reported GreyMatters comment immediately -- reuses the
  -- table's own pre-existing RLS policy ("Approved comments are
  -- viewable by everyone", status = 'approved') rather than building a
  -- second hide mechanism. Reversible by an admin clearing the report.
  IF p_content_type = 'greymatters_comment' THEN
    UPDATE public.comments SET status = 'pending' WHERE id = p_content_id;
  END IF;

  -- Page every admin via the existing shared notifications table/bell
  -- -- every admin sees this the next time they're on any Greyin app,
  -- not just whoever happens to check /admin/reports next.
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT id, 'content_report', 'New content report', p_reason, '/admin/reports'
  FROM public.profiles WHERE role = 'admin';

  RETURN v_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_content_report(TEXT, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_content_report(p_report_id UUID, p_status TEXT, p_admin_notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_content_type TEXT;
  v_content_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_status NOT IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT content_type, content_id INTO v_content_type, v_content_id
  FROM public.content_reports WHERE id = p_report_id;

  UPDATE public.content_reports
  SET status = p_status, admin_notes = p_admin_notes, resolved_by = auth.uid(), resolved_at = now()
  WHERE id = p_report_id;

  -- A dismissed report means the reported comment was judged fine --
  -- restore it (submit_content_report soft-hid it via status='pending'
  -- at report time; without this it would stay hidden forever even
  -- though nothing was actually wrong with it). A 'resolved' report
  -- means real action was taken (the admin deletes it separately via
  -- the existing /api/admin/comments/delete route if warranted), so
  -- this only fires for 'dismissed'.
  IF v_content_type = 'greymatters_comment' AND p_status = 'dismissed' THEN
    UPDATE public.comments SET status = 'approved' WHERE id = v_content_id AND status = 'pending';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_content_report(UUID, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- User blocking (direct messages)
-- ------------------------------------------------------------

CREATE TABLE public.blocked_users (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own block list"
  ON public.blocked_users FOR ALL
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());

-- A blocked sender can no longer start a NEW conversation with (or be
-- started by) whoever blocked them, in either direction.
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id UUID)
RETURNS UUID
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF auth.uid() = other_user_id THEN
    RAISE EXCEPTION 'Cannot start a conversation with yourself';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = auth.uid() AND blocked_id = other_user_id)
       OR (blocker_id = other_user_id AND blocked_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Cannot start a conversation with this user';
  END IF;

  SELECT cp1.conversation_id INTO v_conversation_id
  FROM conversation_participants cp1
  JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = auth.uid() AND cp2.user_id = other_user_id
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO conversations DEFAULT VALUES RETURNING id INTO v_conversation_id;
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES (v_conversation_id, auth.uid());
  INSERT INTO conversation_participants (conversation_id, user_id) VALUES (v_conversation_id, other_user_id);

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Also stops a message being sent into an EXISTING conversation once
-- the recipient has since blocked the sender (get_or_create_conversation
-- alone only guards conversation *creation*).
--
-- The block check has to go through a SECURITY DEFINER helper, not a
-- bare correlated subquery on blocked_users -- confirmed live (e2e,
-- 2026-09-13) that a plain subquery silently never blocks anything: the
-- WITH CHECK subquery runs under the SENDER's own RLS view of
-- blocked_users, and blocked_users' own policy only lets a blocker see
-- rows THEY created (blocker_id = auth.uid()) -- the sender being
-- checked is the blocked_id, not the blocker, so from their own
-- RLS-scoped vantage point the block row they're supposed to be caught
-- by is invisible, and NOT EXISTS was always true regardless.
CREATE OR REPLACE FUNCTION public.sender_is_blocked_in_conversation(p_conversation_id UUID, p_sender_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocked_users b
    JOIN conversation_participants cp ON cp.conversation_id = p_conversation_id AND cp.user_id = b.blocker_id
    WHERE b.blocked_id = p_sender_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.sender_is_blocked_in_conversation(UUID, UUID) TO authenticated;

DROP POLICY "Participants can send messages in their conversations" ON public.direct_messages;
CREATE POLICY "Participants can send messages in their conversations"
  ON public.direct_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_participants.conversation_id = direct_messages.conversation_id
        AND conversation_participants.user_id = auth.uid()
    )
    AND NOT public.sender_is_blocked_in_conversation(direct_messages.conversation_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.block_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF auth.uid() = p_user_id THEN RAISE EXCEPTION 'Cannot block yourself'; END IF;
  INSERT INTO public.blocked_users (blocker_id, blocked_id) VALUES (auth.uid(), p_user_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated;
