-- ============================================================
-- Salt & Pepper: Discussions + The Lab (builder_projects)
-- ============================================================
--
-- Salt & Pepper's /discussions page was hijacking the blog's
-- `comments` table as a placeholder, and /projects ("The Lab")
-- was 100% hardcoded mock data. This adds real tables for both,
-- matching the shape already implied by the UI.
--
-- Run this after 008_newsletter.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.discussions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  upvote_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.discussions IS 'Salt & Pepper discussion threads';

ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view discussions"
  ON public.discussions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Members can create discussions"
  ON public.discussions FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own discussions"
  ON public.discussions FOR UPDATE
  USING (auth.uid() = author_id);

CREATE TABLE IF NOT EXISTS public.discussion_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discussion_id UUID REFERENCES public.discussions ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view replies"
  ON public.discussion_replies FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Members can reply"
  ON public.discussion_replies FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE OR REPLACE FUNCTION update_discussion_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.discussions
  SET reply_count = (SELECT COUNT(*) FROM public.discussion_replies WHERE discussion_id = NEW.discussion_id)
  WHERE id = NEW.discussion_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_discussion_reply_count_trigger
  AFTER INSERT ON public.discussion_replies
  FOR EACH ROW EXECUTE FUNCTION update_discussion_reply_count();

CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON public.discussions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_discussion_id ON public.discussion_replies(discussion_id);

-- ============================================================
-- The Lab: builder_projects
-- ============================================================

CREATE TABLE IF NOT EXISTS public.builder_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tech_stack TEXT[] DEFAULT '{}',
  github_url TEXT,
  demo_url TEXT,
  images TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('idea', 'in_progress', 'completed')) DEFAULT 'idea',
  looking_for TEXT,
  upvote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.builder_projects IS 'Salt & Pepper "The Lab" project showcase';

ALTER TABLE public.builder_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view projects"
  ON public.builder_projects FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Members can create projects"
  ON public.builder_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their own projects"
  ON public.builder_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.project_upvotes (
  project_id UUID REFERENCES public.builder_projects ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE public.project_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view upvotes"
  ON public.project_upvotes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Members can upvote"
  ON public.project_upvotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can remove their own upvote"
  ON public.project_upvotes FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_project_upvote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.builder_projects
  SET upvote_count = (
    SELECT COUNT(*) FROM public.project_upvotes
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
  )
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_project_upvote_count_insert_trigger
  AFTER INSERT ON public.project_upvotes
  FOR EACH ROW EXECUTE FUNCTION update_project_upvote_count();

CREATE TRIGGER update_project_upvote_count_delete_trigger
  AFTER DELETE ON public.project_upvotes
  FOR EACH ROW EXECUTE FUNCTION update_project_upvote_count();

CREATE INDEX IF NOT EXISTS idx_builder_projects_created_at ON public.builder_projects(created_at DESC);
