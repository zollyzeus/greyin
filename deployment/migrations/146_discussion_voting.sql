-- ============================================================
-- Salt & Pepper: real up/down voting on discussions
-- ============================================================
--
-- discussions.upvote_count (009) has never had any write path --
-- flagged as a known gap in 025's own header comment and never
-- actioned since. discussions/page.tsx's "hot" sort
-- (upvote_count * 2 + reply_count) and "top" sort (order by
-- upvote_count) have both silently degraded to reply-count-only /
-- arbitrary order for every discussion, in production, the whole time.
--
-- Real up/down voting (not upvote-only like project_upvotes/post_likes)
-- to match Emergent's actual behavior -- value in {-1,1}, one row per
-- (discussion, user), voting the same direction again toggles off.
-- Confirmed the Salt & Pepper pillar of greyin_score (122's
-- sync_saltnpepper_score_input) keys exclusively off
-- event_type = 'project_upvoted' (The Lab, a different feature) --
-- this migration's new 'discussion_upvoted' event type does NOT feed
-- the score formula, matching the actual scope of the bug being fixed
-- (forum ranking, not reputation scoring).
--
-- Run this after 145_anonymous_page_visits.sql
-- ============================================================

CREATE TABLE public.discussion_votes (
  discussion_id UUID REFERENCES public.discussions ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (discussion_id, user_id)
);

ALTER TABLE public.discussion_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view discussion votes"
  ON public.discussion_votes FOR SELECT
  USING (auth.role() = 'authenticated');

-- No direct INSERT/UPDATE/DELETE policy -- all writes go through
-- vote_discussion() below, same "RPC is the only write path"
-- convention as rate_limit_attempts/page_visits.

CREATE INDEX idx_discussion_votes_discussion_id ON public.discussion_votes(discussion_id);

-- award_reputation() is REVOKEd from PUBLIC/authenticated (067) -- only
-- reachable from inside a SECURITY DEFINER function, same precedent as
-- the referral/reply-count triggers.
CREATE OR REPLACE FUNCTION public.vote_discussion(p_discussion_id UUID, p_value INT)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_voter UUID := auth.uid();
  v_old_value INT;
  v_author UUID;
  v_new_score INT;
BEGIN
  IF v_voter IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to vote';
  END IF;
  IF p_value NOT IN (-1, 0, 1) THEN
    RAISE EXCEPTION 'Invalid vote value';
  END IF;

  SELECT author_id INTO v_author FROM discussions WHERE id = p_discussion_id;
  IF v_author IS NULL THEN
    RAISE EXCEPTION 'Discussion not found';
  END IF;

  SELECT value INTO v_old_value FROM discussion_votes WHERE discussion_id = p_discussion_id AND user_id = v_voter;
  v_old_value := COALESCE(v_old_value, 0);

  IF p_value = 0 OR v_old_value = p_value THEN
    -- explicit clear, or voting the same direction again = toggle off
    DELETE FROM discussion_votes WHERE discussion_id = p_discussion_id AND user_id = v_voter;
    p_value := 0;
  ELSE
    INSERT INTO discussion_votes (discussion_id, user_id, value) VALUES (p_discussion_id, v_voter, p_value)
    ON CONFLICT (discussion_id, user_id) DO UPDATE SET value = EXCLUDED.value, created_at = now();
  END IF;

  SELECT COALESCE(SUM(value), 0) INTO v_new_score FROM discussion_votes WHERE discussion_id = p_discussion_id;
  UPDATE discussions SET upvote_count = v_new_score WHERE id = p_discussion_id;

  IF v_author != v_voter AND (p_value - v_old_value) != 0 THEN
    PERFORM award_reputation(v_author, 'discussion_upvoted', p_value - v_old_value, p_discussion_id);
  END IF;

  RETURN v_new_score;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_discussion(UUID, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
