-- ============================================================
-- Skill endorsements (open) + skill ratings (interaction-gated)
-- ============================================================
--
-- profile_skills: the canonical "does this profile have this skill"
-- list, decoupled from candidates.skills (candidates is the ONLY
-- existing skills list on the platform -- a FreeAgent- or StackEdge-
-- native Verified Expert with no candidates row has nowhere else to
-- hang a skill). Seeded from candidates.skills via a one-way, additive
-- sync trigger (ON CONFLICT DO NOTHING -- a resume re-parse producing
-- a shorter list must never silently delete a skill someone endorsed).
--
-- skill_endorsements: fully open, one-click, no free text -- any
-- authenticated user, on any skill that exists in profile_skills.
-- Not follow-gated: matches this platform's own auth.role() =
-- 'authenticated' convention for open interactions (project_asks,
-- discussions), not a follow-graph gate.
--
-- skill_ratings: gated to a real completed interaction, scoped to the
-- specific skills tagged on THAT interaction. One shared table across
-- FreeAgent (gig_orders) and StackEdge (project_applications) -- same
-- "one physical schema, many pillars" convention as notifications
-- (017) and user_follows (053).
--
-- Run this after 053_activity_feed.sql
-- ============================================================

-- ------------------------------------------------------------
-- profile_skills
-- ------------------------------------------------------------
CREATE TABLE public.profile_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill)
);

CREATE INDEX idx_profile_skills_user_id ON public.profile_skills(user_id);

ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Skills are viewable by everyone"
  ON public.profile_skills FOR SELECT
  USING (true);

CREATE POLICY "Users manage their own skills"
  ON public.profile_skills FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_profile_skills_from_candidate()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.skills IS NOT NULL THEN
    INSERT INTO public.profile_skills (user_id, skill)
    SELECT NEW.user_id, s FROM unnest(NEW.skills) AS s
    ON CONFLICT (user_id, skill) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_candidate_skills_synced
  AFTER INSERT OR UPDATE OF skills ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_skills_from_candidate();

-- One-time backfill for existing candidates rows.
INSERT INTO public.profile_skills (user_id, skill)
SELECT c.user_id, s
FROM public.candidates c, unnest(c.skills) AS s
WHERE c.skills IS NOT NULL
ON CONFLICT (user_id, skill) DO NOTHING;

-- ------------------------------------------------------------
-- skill_endorsements: open, one-click, binary
-- ------------------------------------------------------------
CREATE TABLE public.skill_endorsements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endorser_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endorsee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (endorser_id, endorsee_id, skill),
  CONSTRAINT skill_endorsements_no_self_endorse CHECK (endorser_id <> endorsee_id)
);

CREATE INDEX idx_skill_endorsements_endorsee ON public.skill_endorsements(endorsee_id, skill);

ALTER TABLE public.skill_endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Endorsements are viewable by everyone"
  ON public.skill_endorsements FOR SELECT
  USING (true);

CREATE POLICY "Any authenticated user can endorse a real skill"
  ON public.skill_endorsements FOR INSERT
  WITH CHECK (
    auth.uid() = endorser_id
    AND endorser_id <> endorsee_id
    AND EXISTS (SELECT 1 FROM public.profile_skills WHERE user_id = endorsee_id AND skill = skill_endorsements.skill)
  );

CREATE POLICY "Endorsers can remove their own endorsement"
  ON public.skill_endorsements FOR DELETE
  USING (auth.uid() = endorser_id);

-- ------------------------------------------------------------
-- skill_ratings: gated to a real completed interaction
-- ------------------------------------------------------------
CREATE TABLE public.skill_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rater_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  stage TEXT NOT NULL DEFAULT 'initial' CHECK (stage IN ('initial', 'verified')),
  gig_order_id UUID REFERENCES public.gig_orders(id) ON DELETE CASCADE,
  project_application_id UUID REFERENCES public.project_applications(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT skill_ratings_one_context CHECK (
    (gig_order_id IS NOT NULL AND project_application_id IS NULL) OR
    (gig_order_id IS NULL AND project_application_id IS NOT NULL)),
  -- NULLs are distinct per Postgres unique-constraint semantics, so
  -- these two constraints only ever collide within their own context.
  UNIQUE (rater_id, ratee_id, skill, gig_order_id),
  UNIQUE (rater_id, ratee_id, skill, project_application_id)
);

CREATE INDEX idx_skill_ratings_ratee ON public.skill_ratings(ratee_id, skill);

ALTER TABLE public.skill_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Skill ratings are viewable by everyone"
  ON public.skill_ratings FOR SELECT
  USING (true);

-- FreeAgent: buyer rates seller (mirrors order_reviews' own direction),
-- only once the order is completed, only for skills in gigs.tags.
CREATE POLICY "Buyers can rate completed order skills"
  ON public.skill_ratings FOR INSERT
  WITH CHECK (
    gig_order_id IS NOT NULL
    AND auth.uid() = rater_id
    AND EXISTS (
      SELECT 1 FROM public.gig_orders go
      JOIN public.gigs g ON g.id = go.gig_id
      WHERE go.id = skill_ratings.gig_order_id
        AND go.buyer_id = auth.uid()
        AND go.status = 'completed'
        AND go.seller_id = skill_ratings.ratee_id
        AND skill_ratings.skill = ANY(g.tags)
    )
  );

-- StackEdge, initial rating, bidirectional: Builder can rate Supporter
-- and vice versa, on skills from the ask's own tag list either way.
-- Gated on EITHER a real chat having happened between the two OR the
-- traditional ask-closed+accepted signal -- either condition alone is
-- enough to allow an early, informal rating right after a
-- pre-acceptance "quick technical assessment" chat, not only after the
-- engagement formally closes.
CREATE POLICY "StackEdge collaborators can give an initial skill rating"
  ON public.skill_ratings FOR INSERT
  WITH CHECK (
    project_application_id IS NOT NULL
    AND auth.uid() = rater_id
    AND stage = 'initial'
    AND EXISTS (
      SELECT 1 FROM public.project_applications pa
      JOIN public.project_asks ask ON ask.id = pa.ask_id
      WHERE pa.id = skill_ratings.project_application_id
        AND skill_ratings.skill = ANY(ask.skills)
        AND (
          (ask.created_by = auth.uid() AND pa.applicant_id = skill_ratings.ratee_id) OR
          (pa.applicant_id = auth.uid() AND ask.created_by = skill_ratings.ratee_id)
        )
        AND (
          (ask.status = 'closed' AND pa.status = 'accepted')
          OR EXISTS (
            SELECT 1 FROM public.conversation_participants cp1
            JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
            JOIN public.direct_messages dm ON dm.conversation_id = cp1.conversation_id
            WHERE cp1.user_id = auth.uid() AND cp2.user_id = skill_ratings.ratee_id
          )
        )
    )
  );

-- Revision: only the original rater, only flipping stage to 'verified',
-- only once a real verified outcome exists for that application/ratee --
-- lets an early informal rating be corrected once real verified work
-- exists, without allowing a second, separate rating row (the UNIQUE
-- constraints above already prevent that).
CREATE POLICY "Raters can revise their rating once the outcome is verified"
  ON public.skill_ratings FOR UPDATE
  USING (auth.uid() = rater_id AND project_application_id IS NOT NULL)
  WITH CHECK (
    auth.uid() = rater_id
    AND stage = 'verified'
    AND EXISTS (
      SELECT 1 FROM public.verified_outcomes vo
      WHERE vo.application_id = skill_ratings.project_application_id
        AND vo.subject_user_id = skill_ratings.ratee_id
        AND vo.status = 'verified'
    )
  );

-- No shared "handle_updated_at" trigger function exists anywhere in
-- this deployment (every prior updated_at bump is written inline in
-- its own function) -- this one is generic/reusable on purpose so
-- Phase 2's employment-history table can reuse it too, instead of
-- duplicating an identical function under a second name.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER skill_ratings_updated_at
  BEFORE UPDATE ON public.skill_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- profile_skill_summary: aggregate view, same unfiltered-inside-the-
-- view / RLS-does-the-work convention as activity_feed (053) and
-- platform_search_index (037).
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.profile_skill_summary AS
SELECT
  ps.user_id,
  ps.skill,
  ps.featured,
  COALESCE(e.endorsement_count, 0) AS endorsement_count,
  COALESCE(r.rating_count, 0) AS rating_count,
  r.avg_rating
FROM public.profile_skills ps
LEFT JOIN (
  SELECT endorsee_id AS user_id, skill, COUNT(*) AS endorsement_count
  FROM public.skill_endorsements GROUP BY endorsee_id, skill
) e ON e.user_id = ps.user_id AND e.skill = ps.skill
LEFT JOIN (
  SELECT ratee_id AS user_id, skill, COUNT(*) AS rating_count, ROUND(AVG(rating)::numeric, 2) AS avg_rating
  FROM public.skill_ratings GROUP BY ratee_id, skill
) r ON r.user_id = ps.user_id AND r.skill = ps.skill;

GRANT SELECT ON public.profile_skill_summary TO anon, authenticated;

-- ------------------------------------------------------------
-- Notifications -- same SECURITY DEFINER trigger convention as 017/051.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_skill_endorsement()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_endorser_name TEXT;
BEGIN
  SELECT full_name INTO v_endorser_name FROM profiles WHERE id = NEW.endorser_id;
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (NEW.endorsee_id, 'skill_endorsed', 'New skill endorsement',
          COALESCE(v_endorser_name, 'Someone') || ' endorsed you for "' || NEW.skill || '"', '/profile');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_skill_endorsement_created
  AFTER INSERT ON public.skill_endorsements
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_skill_endorsement();

CREATE OR REPLACE FUNCTION public.notify_new_skill_rating()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (NEW.ratee_id, 'skill_rated', 'New skill rating',
          'You were rated ' || NEW.rating || '/5 for "' || NEW.skill || '"', '/profile');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_skill_rating_created
  AFTER INSERT ON public.skill_ratings
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_skill_rating();

NOTIFY pgrst, 'reload schema';
