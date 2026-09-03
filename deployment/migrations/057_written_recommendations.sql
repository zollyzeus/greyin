-- ============================================================
-- Written recommendations (LinkedIn-style testimonials)
-- ============================================================
--
-- Open eligibility -- any authenticated user, matching
-- skill_endorsements' own "by anybody" gate (054) rather than a
-- follow-graph restriction. Unlike an endorsement, this needs the
-- recipient's approval before it's public: a recommendation is a much
-- richer, more consequential piece of content than a one-click
-- endorsement, and an unwelcome or bad-faith "recommendation" showing
-- up on someone's profile with no say from them is a real harm
-- endorsements don't have.
--
-- Run this after 056_mentor_sessions.sql
-- ============================================================

CREATE TABLE public.written_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recommender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recommendee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT written_recommendations_no_self_recommend CHECK (recommender_id <> recommendee_id)
);

CREATE INDEX idx_written_recommendations_recommendee ON public.written_recommendations(recommendee_id, status);

ALTER TABLE public.written_recommendations ENABLE ROW LEVEL SECURITY;

-- Approved recommendations are public; the recommender can always see
-- their own (to know what they wrote and its current status); the
-- recommendee can always see everything addressed to them (including
-- pending ones, so they have something to review/approve/dismiss).
CREATE POLICY "Approved recommendations are public, own either way"
  ON public.written_recommendations FOR SELECT
  USING (status = 'approved' OR auth.uid() = recommender_id OR auth.uid() = recommendee_id);

CREATE POLICY "Any authenticated user can write a recommendation"
  ON public.written_recommendations FOR INSERT
  WITH CHECK (auth.uid() = recommender_id AND recommender_id <> recommendee_id AND status = 'pending');

-- Only the recommendee can approve/dismiss.
CREATE POLICY "Recommendees can approve or dismiss their own recommendations"
  ON public.written_recommendations FOR UPDATE
  USING (auth.uid() = recommendee_id)
  WITH CHECK (auth.uid() = recommendee_id AND status IN ('approved', 'dismissed'));

-- RLS's WITH CHECK only constrains which ROWS qualify, not which COLUMNS
-- an UPDATE touches -- without this, the policy above would still let a
-- recommendee rewrite `body`/`recommender_id` in the same statement that
-- sets status='approved', silently forging what the recommender
-- supposedly wrote. This trigger is what actually makes UPDATE
-- status-only.
CREATE OR REPLACE FUNCTION public.enforce_recommendation_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body
    OR NEW.recommender_id IS DISTINCT FROM OLD.recommender_id
    OR NEW.recommendee_id IS DISTINCT FROM OLD.recommendee_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only status may be changed on a written recommendation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER written_recommendations_immutable_fields
  BEFORE UPDATE ON public.written_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_recommendation_immutable_fields();

CREATE TRIGGER written_recommendations_updated_at
  BEFORE UPDATE ON public.written_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.notify_new_written_recommendation()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recommender_name TEXT;
BEGIN
  SELECT full_name INTO v_recommender_name FROM profiles WHERE id = NEW.recommender_id;
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (NEW.recommendee_id, 'recommendation_pending', 'New recommendation to review',
          COALESCE(v_recommender_name, 'Someone') || ' wrote you a recommendation', '/profile');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_written_recommendation_created
  AFTER INSERT ON public.written_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_written_recommendation();

NOTIFY pgrst, 'reload schema';
