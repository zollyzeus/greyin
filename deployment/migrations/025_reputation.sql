-- ============================================================
-- Karma/reputation (Salt & Pepper) — from the "not recommended" list,
-- built anyway per explicit request
-- ============================================================
--
-- Scoped to signal that's already real: starting a discussion, replying,
-- starting a project, and having a project upvoted (project_upvotes
-- already exists with real per-user dedup). Discussion upvoting has a
-- column (upvote_count) but no actual per-user upvote mechanism wired up
-- anywhere in the app — that's a separate, pre-existing gap, not something
-- to silently half-build as a side effect of this migration.
-- ============================================================

CREATE TABLE public.reputation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  points INTEGER NOT NULL,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reputation_events_user_id ON public.reputation_events(user_id);

ALTER TABLE public.reputation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reputation events are viewable by everyone"
  ON public.reputation_events FOR SELECT
  USING (true);

CREATE VIEW public.reputation_scores AS
SELECT user_id, COALESCE(SUM(points), 0) AS score
FROM public.reputation_events
GROUP BY user_id;

GRANT SELECT ON public.reputation_scores TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_reputation(p_user_id UUID, p_event_type TEXT, p_points INTEGER, p_ref_id UUID)
RETURNS VOID SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO reputation_events (user_id, event_type, points, ref_id)
  VALUES (p_user_id, p_event_type, p_points, p_ref_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.reputation_on_discussion_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM award_reputation(NEW.author_id, 'discussion_created', 1, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_discussion_created_award_reputation
  AFTER INSERT ON public.discussions
  FOR EACH ROW EXECUTE FUNCTION public.reputation_on_discussion_created();

CREATE OR REPLACE FUNCTION public.reputation_on_reply_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM award_reputation(NEW.author_id, 'reply_given', 1, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_reply_created_award_reputation
  AFTER INSERT ON public.discussion_replies
  FOR EACH ROW EXECUTE FUNCTION public.reputation_on_reply_created();

CREATE OR REPLACE FUNCTION public.reputation_on_project_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM award_reputation(NEW.user_id, 'project_created', 1, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_project_created_award_reputation
  AFTER INSERT ON public.builder_projects
  FOR EACH ROW EXECUTE FUNCTION public.reputation_on_project_created();

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

CREATE TRIGGER on_project_upvoted_award_reputation
  AFTER INSERT ON public.project_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.reputation_on_project_upvoted();

-- Backfill from existing content so day-one activity counts.
INSERT INTO public.reputation_events (user_id, event_type, points, ref_id)
SELECT author_id, 'discussion_created', 1, id FROM public.discussions WHERE author_id IS NOT NULL;

INSERT INTO public.reputation_events (user_id, event_type, points, ref_id)
SELECT author_id, 'reply_given', 1, id FROM public.discussion_replies WHERE author_id IS NOT NULL;

INSERT INTO public.reputation_events (user_id, event_type, points, ref_id)
SELECT user_id, 'project_created', 1, id FROM public.builder_projects WHERE user_id IS NOT NULL;

INSERT INTO public.reputation_events (user_id, event_type, points, ref_id)
SELECT bp.user_id, 'project_upvoted', 2, pu.project_id
FROM public.project_upvotes pu
JOIN public.builder_projects bp ON bp.id = pu.project_id
WHERE bp.user_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
