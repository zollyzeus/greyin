-- ============================================================
-- Gap-audit items #5 (feature wishlist) and #3 (user feedback loop).
-- Both platform-wide, house on Greyin Hub (no pillar affiliation of its
-- own -- same precedent as the LLM-provider panel and test-data
-- cleanup, admin/page.tsx's own header comment). See docs/
-- emergent_deployment_gap.md for the two architecture questions
-- confirmed with the user: feedback requires login (no anonymous
-- submission), and submission is centralized here rather than
-- duplicated into all 6 pillar apps.
-- ============================================================

CREATE TABLE public.feature_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'planned', 'shipped', 'declined')),
  upvote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view feature requests"
  ON public.feature_requests FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Members can submit feature requests"
  ON public.feature_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any feature request"
  ON public.feature_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete any feature request"
  ON public.feature_requests FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Exact shape as project_upvotes (009_saltnpepper_community.sql).
CREATE TABLE public.feature_request_upvotes (
  feature_request_id UUID NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (feature_request_id, user_id)
);

ALTER TABLE public.feature_request_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view feature request upvotes"
  ON public.feature_request_upvotes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Members can upvote a feature request"
  ON public.feature_request_upvotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can remove their own feature request upvote"
  ON public.feature_request_upvotes FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_feature_request_upvote_count()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feature_requests SET upvote_count = upvote_count + 1 WHERE id = NEW.feature_request_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feature_requests SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.feature_request_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER update_feature_request_upvote_count_insert_trigger
  AFTER INSERT ON public.feature_request_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.update_feature_request_upvote_count();

CREATE TRIGGER update_feature_request_upvote_count_delete_trigger
  AFTER DELETE ON public.feature_request_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.update_feature_request_upvote_count();

-- --------------------------------------------------------------

CREATE TABLE public.platform_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_app TEXT,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replied')),
  admin_reply TEXT,
  replied_by UUID REFERENCES public.profiles(id),
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
  ON public.platform_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback"
  ON public.platform_feedback FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can submit their own feedback"
  ON public.platform_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any feedback"
  ON public.platform_feedback FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Notifies the submitter when an admin sets admin_reply -- same
-- SECURITY DEFINER shape as notify_new_application (017), fires
-- through the shared notifications table which every pillar app
-- already reads from its own /notifications page.
CREATE OR REPLACE FUNCTION public.notify_feedback_replied()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.admin_reply IS NOT NULL AND (OLD.admin_reply IS NULL OR OLD.admin_reply IS DISTINCT FROM NEW.admin_reply) THEN
    -- link is a relative path, same convention as every other notification
    -- site -- each app's notification-link.ts resolves it against the
    -- owning pillar's domain (added 'greyin_hub' there for this).
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (NEW.user_id, 'feedback_replied', 'The team replied to your feedback', LEFT(NEW.admin_reply, 200), '/feedback');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_feedback_replied
  AFTER UPDATE ON public.platform_feedback
  FOR EACH ROW EXECUTE FUNCTION public.notify_feedback_replied();

NOTIFY pgrst, 'reload schema';
