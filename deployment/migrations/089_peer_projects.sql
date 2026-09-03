-- ============================================================
-- Peer-confirmed projects (off-platform work history, mutually
-- confirmed, contribution-rated) + a separate peer_score
-- ============================================================
--
-- Every existing trust signal (verified_outcomes, skill_ratings,
-- collaborators) is gated on a real ON-PLATFORM transaction -- an
-- accepted StackEdge ask or a completed FreeAgent order. That's a
-- cold-start gap: a member's entire pre-Greyin career (which is most
-- of it, for anyone senior) contributes nothing. This adds a
-- self-reported "I worked on X at Company Y with these people" claim
-- that only becomes real once every tagged teammate independently
-- confirms it -- deliberately never called "verified" anywhere (that
-- word is reserved for transaction-backed evidence elsewhere on this
-- platform); the UI-facing term is "peer-confirmed".
--
-- Design decisions, and why:
--   - peer_projects itself is publicly readable once created (like a
--     resume line) -- but a tagged teammate's membership only becomes
--     visible to third parties once THEY confirm it (mirrors
--     written_recommendations' pending/approved split, 057), so an
--     unconfirmed tag never reads as a confirmed collaboration.
--   - Contribution ratings require BOTH rater and ratee to already be
--     'confirmed' members of the same project -- a one-sided tag can
--     never itself produce a rating. Still not collusion-proof (two
--     accounts can mutually confirm a fake project), but requires
--     active cooperation from both sides rather than a unilateral claim.
--   - Ratings are anonymous in display, same convention as
--     company_reviews (058): rater_id exists purely for the
--     eligibility/uniqueness check, never selected/joined by app code.
--   - peer_score is a fully separate column on greyin_scores, NOT
--     folded into the existing platform-verified blended `score` --
--     see the view rebuild below. Keeping platform-verified and
--     peer-confirmed as two numbers, never one, is the whole point:
--     the blended score's credibility depends on every input being
--     transaction-backed, and merging in a mutually-self-reported
--     signal would quietly weaken that for every existing input too.
--   - Once title/company change after confirmed, unchecked, would let
--     a project be rated then silently rewritten -- edits are only
--     allowed by the creator while no one else has confirmed yet.
--
-- Run this after 088_fix_longlist_subscription_check.sql
-- ============================================================

-- Both tables created up front, before any RLS/policies -- the
-- peer_projects UPDATE policy below needs to reference
-- peer_project_members, so that table must already exist first.
CREATE TABLE public.peer_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT,
  started_on DATE,
  ended_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
);

CREATE INDEX idx_peer_projects_creator ON public.peer_projects(creator_id);

CREATE TABLE public.peer_project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.peer_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (project_id, user_id)
);

CREATE INDEX idx_peer_project_members_project ON public.peer_project_members(project_id);
CREATE INDEX idx_peer_project_members_user ON public.peer_project_members(user_id, status);

ALTER TABLE public.peer_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Peer projects are viewable by everyone"
  ON public.peer_projects FOR SELECT
  USING (true);

CREATE POLICY "Creators manage their own peer projects"
  ON public.peer_projects FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Edits blocked once anyone besides the creator has confirmed -- see
-- header comment. Deletion (below) stays allowed regardless, so a
-- creator can always retract a project outright.
CREATE POLICY "Creators can edit only before anyone else confirms"
  ON public.peer_projects FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (
    auth.uid() = creator_id
    AND NOT EXISTS (
      SELECT 1 FROM public.peer_project_members m
      WHERE m.project_id = peer_projects.id AND m.user_id <> peer_projects.creator_id AND m.status = 'confirmed'
    )
  );

CREATE POLICY "Creators can delete their own peer projects"
  ON public.peer_projects FOR DELETE
  USING (auth.uid() = creator_id);

CREATE POLICY "Admins can delete any peer project"
  ON public.peer_projects FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER peer_projects_updated_at
  BEFORE UPDATE ON public.peer_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- peer_project_members (table already created above)
-- ------------------------------------------------------------
ALTER TABLE public.peer_project_members ENABLE ROW LEVEL SECURITY;

-- Confirmed membership is public; a still-pending or declined tag is
-- visible only to the tagged member (to act on) and the project's
-- creator (to see who hasn't responded) -- same "approved-or-own"
-- shape as written_recommendations (057).
CREATE POLICY "Confirmed members are public, pending/declined stay private to those involved"
  ON public.peer_project_members FOR SELECT
  USING (
    status = 'confirmed'
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.peer_projects p WHERE p.id = project_id AND p.creator_id = auth.uid())
  );

-- Only the project's creator can tag a teammate onto it.
CREATE POLICY "Creators tag teammates onto their own peer projects"
  ON public.peer_project_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.peer_projects p WHERE p.id = project_id AND p.creator_id = auth.uid())
  );

-- Only the tagged member can respond, and only to their own row --
-- the immutable-fields trigger below stops a confirm/decline call
-- from also rewriting project_id/user_id in the same statement.
CREATE POLICY "Tagged members confirm or decline their own tag"
  ON public.peer_project_members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status IN ('confirmed', 'declined'));

CREATE OR REPLACE FUNCTION public.enforce_peer_project_member_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only status may be changed on a peer project tag';
  END IF;
  IF NEW.status IN ('confirmed', 'declined') AND OLD.status = 'pending' THEN
    NEW.responded_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER peer_project_members_immutable_fields
  BEFORE UPDATE ON public.peer_project_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_peer_project_member_immutable_fields();

-- A mistaken tag can only be retracted while still pending -- once
-- confirmed it's a real mutual record, not the creator's alone to erase.
CREATE POLICY "Creators can remove a still-pending tag"
  ON public.peer_project_members FOR DELETE
  USING (
    status = 'pending'
    AND EXISTS (SELECT 1 FROM public.peer_projects p WHERE p.id = project_id AND p.creator_id = auth.uid())
  );

-- The creator is a participant in their own project by definition --
-- auto-confirmed, no self-tag round trip needed.
CREATE OR REPLACE FUNCTION public.auto_confirm_peer_project_creator()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.peer_project_members (project_id, user_id, status, responded_at)
  VALUES (NEW.id, NEW.creator_id, 'confirmed', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_peer_project_created
  AFTER INSERT ON public.peer_projects
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_peer_project_creator();

CREATE OR REPLACE FUNCTION public.notify_peer_project_tag()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator_name TEXT;
  v_title TEXT;
BEGIN
  -- The creator's own auto-confirm insert (above) shares this same
  -- table -- skip notifying someone about tagging themselves.
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;
  SELECT p.title, pr.full_name INTO v_title, v_creator_name
  FROM public.peer_projects p JOIN public.profiles pr ON pr.id = p.creator_id
  WHERE p.id = NEW.project_id;
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (NEW.user_id, 'peer_project_tag', 'Tagged as a project teammate',
          COALESCE(v_creator_name, 'Someone') || ' tagged you on "' || COALESCE(v_title, 'a project') || '" -- confirm to add it to your profile',
          '/dashboard');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_peer_project_member_tagged
  AFTER INSERT ON public.peer_project_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_peer_project_tag();

-- ------------------------------------------------------------
-- peer_project_ratings
-- ------------------------------------------------------------
CREATE TABLE public.peer_project_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.peer_projects(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contribution_rating INTEGER NOT NULL CHECK (contribution_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, rater_id, ratee_id),
  CHECK (rater_id <> ratee_id)
);

CREATE INDEX idx_peer_project_ratings_ratee ON public.peer_project_ratings(ratee_id);

ALTER TABLE public.peer_project_ratings ENABLE ROW LEVEL SECURITY;

-- Publicly readable at the RLS layer, same as company_reviews (058) --
-- anonymity is enforced by app code never selecting/joining rater_id,
-- not by hiding the column here. See companies/[id]/page.tsx for the
-- existing precedent this follows.
CREATE POLICY "Peer project ratings are viewable by everyone"
  ON public.peer_project_ratings FOR SELECT
  USING (true);

-- Both sides must already be confirmed members of the SAME project --
-- the actual mutual-confirmation gate. A pending or declined tag
-- cannot rate or be rated.
CREATE POLICY "Confirmed teammates can rate each other's contribution"
  ON public.peer_project_ratings FOR INSERT
  WITH CHECK (
    auth.uid() = rater_id
    AND rater_id <> ratee_id
    AND EXISTS (
      SELECT 1 FROM public.peer_project_members m
      WHERE m.project_id = peer_project_ratings.project_id AND m.user_id = rater_id AND m.status = 'confirmed'
    )
    AND EXISTS (
      SELECT 1 FROM public.peer_project_members m
      WHERE m.project_id = peer_project_ratings.project_id AND m.user_id = ratee_id AND m.status = 'confirmed'
    )
  );

CREATE POLICY "Admins can delete any peer project rating"
  ON public.peer_project_ratings FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ------------------------------------------------------------
-- collaborators view: add peer-confirmed pairs as a 3rd source
-- ------------------------------------------------------------
-- Confirmed-confirmed pairs only (a pending tag is not a
-- collaboration yet) -- both directions come naturally from the
-- self-join's m1<->m2 swap, same shape as 059's own two UNION ALL
-- pairs per source.
CREATE OR REPLACE VIEW public.collaborators AS
  SELECT ask.created_by AS user_id, pa.applicant_id AS collaborator_id, 'stackedge'::text AS pillar, pa.created_at AS occurred_at
  FROM public.project_applications pa
  JOIN public.project_asks ask ON ask.id = pa.ask_id
  WHERE pa.status = 'accepted'
UNION ALL
  SELECT pa.applicant_id, ask.created_by, 'stackedge'::text, pa.created_at
  FROM public.project_applications pa
  JOIN public.project_asks ask ON ask.id = pa.ask_id
  WHERE pa.status = 'accepted'
UNION ALL
  SELECT go.buyer_id, go.seller_id, 'freeagent'::text, go.completed_at
  FROM public.gig_orders go
  WHERE go.status = 'completed'
UNION ALL
  SELECT go.seller_id, go.buyer_id, 'freeagent'::text, go.completed_at
  FROM public.gig_orders go
  WHERE go.status = 'completed'
UNION ALL
  SELECT m1.user_id, m2.user_id, 'peer'::text, GREATEST(m1.responded_at, m2.responded_at)
  FROM public.peer_project_members m1
  JOIN public.peer_project_members m2 ON m1.project_id = m2.project_id AND m1.user_id <> m2.user_id
  WHERE m1.status = 'confirmed' AND m2.status = 'confirmed';

GRANT SELECT ON public.collaborators TO authenticated;

-- ------------------------------------------------------------
-- greyin_scores: add peer_score/peer_evidence/peer_headcount as
-- their OWN extra output columns -- never blended into
-- platform_composite or greyin_score (the values everything else on
-- the platform actually gates on: is_verified_expert, search
-- ranking, etc). Rebuilt from 064's definition VERBATIM (constants,
-- stackedge/freeagent/saltnpepper/greymatters CTEs, platform_composite,
-- the 0.85/0.15 tenure-blended greyin_score, is_verified_expert, and
-- the anon+authenticated grant all unchanged) with peer_raw and the
-- three peer_* columns spliced in purely as additions -- see header
-- comment for why they must never enter the existing weighted sums.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.greyin_scores AS
WITH constants AS (
  SELECT 3 AS m_stackedge, 5 AS m_freeagent, 10 AS m_saltnpepper, 5 AS m_greymatters, 3 AS m_peer
),
stackedge_raw AS (
  SELECT subject_user_id AS user_id, AVG(score)::numeric AS raw, COUNT(*) AS v
  FROM public.verified_outcomes
  WHERE status = 'verified'
  GROUP BY subject_user_id
),
freeagent_raw AS (
  SELECT id AS user_id, (seller_rating / 5.0 * 100)::numeric AS raw, total_reviews AS v
  FROM public.profiles
  WHERE total_reviews > 0
),
saltnpepper_raw AS (
  SELECT user_id, (LEAST(SUM(points), 100)::numeric / 100 * 100) AS raw, COUNT(*) AS v
  FROM public.reputation_events
  WHERE event_type = 'project_upvoted'
  GROUP BY user_id
),
greymatters_raw AS (
  SELECT subject_user_id AS user_id, AVG(score)::numeric AS raw, COUNT(*) AS v
  FROM public.ai_quality_scores
  WHERE content_type = 'greymatters_post'
  GROUP BY subject_user_id
),
peer_raw AS (
  SELECT ratee_id AS user_id, (AVG(contribution_rating) / 5.0 * 100)::numeric AS raw, COUNT(*) AS v
  FROM public.peer_project_ratings
  GROUP BY ratee_id
),
platform_stats AS (
  SELECT
    (SELECT AVG(raw) FROM stackedge_raw) AS stackedge_mean,
    (SELECT COUNT(*) FROM stackedge_raw) AS stackedge_headcount,
    (SELECT AVG(raw) FROM freeagent_raw) AS freeagent_mean,
    (SELECT COUNT(*) FROM freeagent_raw) AS freeagent_headcount,
    (SELECT AVG(raw) FROM saltnpepper_raw) AS saltnpepper_mean,
    (SELECT COUNT(*) FROM saltnpepper_raw) AS saltnpepper_headcount,
    (SELECT AVG(raw) FROM greymatters_raw) AS greymatters_mean,
    (SELECT COUNT(*) FROM greymatters_raw) AS greymatters_headcount,
    (SELECT AVG(raw) FROM peer_raw) AS peer_mean,
    (SELECT COUNT(*) FROM peer_raw) AS peer_headcount
),
per_user AS (
  SELECT
    p.id AS user_id,
    p.years_experience,
    pr.v AS stackedge_evidence,
    pr.raw AS stackedge_raw,
    CASE WHEN pr.v IS NOT NULL THEN
      ROUND((pr.v::numeric / (pr.v + c.m_stackedge)) * pr.raw + (c.m_stackedge::numeric / (pr.v + c.m_stackedge)) * s.stackedge_mean)
    END AS stackedge_score,
    fa.v AS freeagent_evidence,
    fa.raw AS freeagent_raw,
    CASE WHEN fa.v IS NOT NULL THEN
      ROUND((fa.v::numeric / (fa.v + c.m_freeagent)) * fa.raw + (c.m_freeagent::numeric / (fa.v + c.m_freeagent)) * s.freeagent_mean)
    END AS freeagent_score,
    sp.v AS saltnpepper_evidence,
    sp.raw AS saltnpepper_raw,
    CASE WHEN sp.v IS NOT NULL THEN
      ROUND((sp.v::numeric / (sp.v + c.m_saltnpepper)) * sp.raw + (c.m_saltnpepper::numeric / (sp.v + c.m_saltnpepper)) * s.saltnpepper_mean)
    END AS saltnpepper_score,
    gm.v AS greymatters_evidence,
    gm.raw AS greymatters_raw,
    CASE WHEN gm.v IS NOT NULL THEN
      ROUND((gm.v::numeric / (gm.v + c.m_greymatters)) * gm.raw + (c.m_greymatters::numeric / (gm.v + c.m_greymatters)) * s.greymatters_mean)
    END AS greymatters_score,
    pe.v AS peer_evidence,
    pe.raw AS peer_raw,
    CASE WHEN pe.v IS NOT NULL THEN
      ROUND((pe.v::numeric / (pe.v + c.m_peer)) * pe.raw + (c.m_peer::numeric / (pe.v + c.m_peer)) * s.peer_mean)
    END AS peer_score,
    s.stackedge_headcount, s.freeagent_headcount, s.saltnpepper_headcount, s.greymatters_headcount, s.peer_headcount
  FROM public.profiles p
  CROSS JOIN constants c
  CROSS JOIN platform_stats s
  LEFT JOIN stackedge_raw pr ON pr.user_id = p.id
  LEFT JOIN freeagent_raw fa ON fa.user_id = p.id
  LEFT JOIN saltnpepper_raw sp ON sp.user_id = p.id
  LEFT JOIN greymatters_raw gm ON gm.user_id = p.id
  LEFT JOIN peer_raw pe ON pe.user_id = p.id
),
-- `scored` reproduces 064's column list VERBATIM, same order, same
-- names, no peer_* mixed in -- Postgres's CREATE OR REPLACE VIEW
-- requires every existing output column to keep its exact name AND
-- position; only genuinely new columns may be appended at the very
-- end, after is_verified_expert (see the final SELECT below).
scored AS (
  SELECT
    user_id,
    stackedge_score, stackedge_evidence, stackedge_headcount,
    freeagent_score, freeagent_evidence, freeagent_headcount,
    saltnpepper_score, saltnpepper_evidence, saltnpepper_headcount,
    greymatters_score, greymatters_evidence, greymatters_headcount,
    years_experience,
    ROUND(
      (
        COALESCE(stackedge_score * LN(stackedge_headcount + 1), 0) +
        COALESCE(freeagent_score * LN(freeagent_headcount + 1), 0) +
        COALESCE(saltnpepper_score * LN(saltnpepper_headcount + 1), 0) +
        COALESCE(greymatters_score * LN(greymatters_headcount + 1), 0)
      ) / NULLIF(
        (CASE WHEN stackedge_score IS NOT NULL THEN LN(stackedge_headcount + 1) ELSE 0 END) +
        (CASE WHEN freeagent_score IS NOT NULL THEN LN(freeagent_headcount + 1) ELSE 0 END) +
        (CASE WHEN saltnpepper_score IS NOT NULL THEN LN(saltnpepper_headcount + 1) ELSE 0 END) +
        (CASE WHEN greymatters_score IS NOT NULL THEN LN(greymatters_headcount + 1) ELSE 0 END),
        0
      )
    ) AS platform_composite,
    CASE WHEN stackedge_score IS NOT NULL OR freeagent_score IS NOT NULL OR saltnpepper_score IS NOT NULL OR greymatters_score IS NOT NULL THEN
      ROUND(
        0.85 * (
          (
            COALESCE(stackedge_score * LN(stackedge_headcount + 1), 0) +
            COALESCE(freeagent_score * LN(freeagent_headcount + 1), 0) +
            COALESCE(saltnpepper_score * LN(saltnpepper_headcount + 1), 0) +
            COALESCE(greymatters_score * LN(greymatters_headcount + 1), 0)
          ) / NULLIF(
            (CASE WHEN stackedge_score IS NOT NULL THEN LN(stackedge_headcount + 1) ELSE 0 END) +
            (CASE WHEN freeagent_score IS NOT NULL THEN LN(freeagent_headcount + 1) ELSE 0 END) +
            (CASE WHEN saltnpepper_score IS NOT NULL THEN LN(saltnpepper_headcount + 1) ELSE 0 END) +
            (CASE WHEN greymatters_score IS NOT NULL THEN LN(greymatters_headcount + 1) ELSE 0 END),
            0
          )
        ) + 0.15 * (LEAST(COALESCE(years_experience, 0), 20) / 20.0 * 100)
      )
    END AS greyin_score
  FROM per_user
),
gated AS (
  SELECT
    *,
    (
      COALESCE(years_experience, 0) >= (SELECT min_years_experience FROM public.platform_gate_settings WHERE id = 1)
      OR COALESCE(greyin_score, 0) >= (SELECT min_greyin_score FROM public.platform_gate_settings WHERE id = 1)
    ) AS is_verified_expert
  FROM scored
)
-- gated.* reproduces the exact 17-column shape 064 already had, in
-- the same order -- peer_score/peer_evidence/peer_headcount are
-- appended here, strictly after is_verified_expert, the only position
-- CREATE OR REPLACE VIEW allows for genuinely new columns.
SELECT gated.*, pu.peer_score, pu.peer_evidence, pu.peer_headcount
FROM gated
JOIN per_user pu ON pu.user_id = gated.user_id;

GRANT SELECT ON public.greyin_scores TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
