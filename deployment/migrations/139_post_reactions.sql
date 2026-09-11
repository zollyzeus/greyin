-- ============================================================
-- Lightweight "like" reaction on GreyMatters posts
-- ============================================================
--
-- GreyMatters has no reaction mechanic at all today (a competitor
-- reference has an article "clap"). Follows this codebase's OWN already-
-- shipped, RLS-correct, trigger-maintained toggle pattern exactly
-- (project_upvotes, 009) rather than a capped-multi-click counter model
-- -- a past author of this exact codebase already flagged
-- discussions.upvote_count as a column with no per-user mechanism wired
-- up (025's header comment) as a known gap, not something to copy. A
-- one-shot toggle is the established, proven, genuinely lightweight
-- shape here.
--
-- Run this after 138_referral_system.sql
-- ============================================================

ALTER TABLE public.posts ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE public.post_likes (
  post_id UUID REFERENCES public.posts ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view likes"
  ON public.post_likes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Members can like a post"
  ON public.post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can remove their own like"
  ON public.post_likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts
  SET like_count = (
    SELECT COUNT(*) FROM public.post_likes
    WHERE post_id = COALESCE(NEW.post_id, OLD.post_id)
  )
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_post_like_count_insert_trigger
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_like_count();

CREATE TRIGGER update_post_like_count_delete_trigger
  AFTER DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_like_count();

NOTIFY pgrst, 'reload schema';
