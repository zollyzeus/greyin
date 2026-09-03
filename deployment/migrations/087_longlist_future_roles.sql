-- ============================================================
-- Longlist: a new pillar for future roles (3/6/9/12 months out),
-- posted anonymously by companies, browsable by members, with an
-- explicit opt-in ("subscribe as future-interested") plus a second,
-- AI-surfaced set of candidates based on stated future interests.
--
-- Anonymity model (deliberately asymmetric, matching the mechanic as
-- specified): the COMPANY stays hidden from members throughout --
-- future_roles_public (below) never exposes company_id or any
-- identifying field, the same discipline company_reviews (058) uses
-- for reviewer identity (NFR-PRIV-01). The MEMBER's identity is what
-- becomes visible, and only to that role's own poster, the moment they
-- subscribe -- the reverse of company_reviews, not the same shape.
-- There is no separate "reveal the company" action: if an employer
-- wants to actually reach out, they use the existing direct-messaging
-- feature (021), which naturally surfaces identity through the
-- conversation itself rather than needing a new reveal mechanism here.
--
-- Run this after 086_fix_refund_race_condition.sql
-- ============================================================

-- ------------------------------------------------------------
-- future_roles -- base table. No member ever gets a SELECT grant on
-- this directly (see future_roles_public below) -- only the posting
-- employer (via company ownership) and service_role can read the raw
-- row, since company_id/posted_by are the exact identifying columns
-- this pillar exists to hide from browsing members.
-- ------------------------------------------------------------
CREATE TABLE public.future_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  posted_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  function_area TEXT,
  seniority_level TEXT,
  target_timeframe TEXT NOT NULL CHECK (target_timeframe IN ('3_months', '6_months', '9_months', '12_months')),
  description TEXT NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  location TEXT,
  is_remote BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_future_roles_company_id ON public.future_roles(company_id);
CREATE INDEX idx_future_roles_status ON public.future_roles(status) WHERE status = 'open';

ALTER TABLE public.future_roles ENABLE ROW LEVEL SECURITY;

-- Only the posting employer (owns the company this role belongs to)
-- can read/write the raw row -- members read the anonymized view
-- instead, never this table.
CREATE POLICY "Employer manages own future roles" ON public.future_roles
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  ) WITH CHECK (
    posted_by = auth.uid()
    AND company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- future_roles_public -- the member-facing read path. Deliberately a
-- plain (non security_invoker) view: members have NO base-table grant
-- on future_roles at all, so this has to run as owner to expose
-- anything -- the anonymity guarantee comes from the hand-curated
-- column list below (no company_id, no posted_by, no company join of
-- any kind), not from RLS row-filtering. This is a different pattern
-- from collaborators' security_invoker fix (SEC-013, 067) -- that view
-- needed to respect row-level RLS it was accidentally bypassing; this
-- one is deliberately column-filtering to a same-shape aggregate
-- that's just missing the identifying fields, matching
-- platform_people_index's (060) same "unfiltered view, curated
-- columns" convention. Also filters to status='open' here, in the view
-- itself, so a raw PostgREST query can't see filled/expired roles
-- either -- not left to app-layer WHERE clauses.
-- ------------------------------------------------------------
CREATE VIEW public.future_roles_public AS
SELECT
  id,
  title,
  function_area,
  seniority_level,
  target_timeframe,
  description,
  skills,
  location,
  is_remote,
  created_at
FROM public.future_roles
WHERE status = 'open';

GRANT SELECT ON public.future_roles_public TO authenticated;

-- ------------------------------------------------------------
-- future_role_subscriptions -- explicit "I'm future-interested" opt-in.
-- This is the mechanic that makes a subscriber's profile visible to
-- the role's poster: RLS lets a member see/manage their own rows, and
-- separately lets the posting employer see (never write) rows for
-- roles they own. Reading the actual candidate profile afterward needs
-- no new grant -- profiles is already broadly readable by any
-- authenticated user (see 060's own comment), same as every other
-- cross-pillar profile lookup on this platform.
-- ------------------------------------------------------------
CREATE TABLE public.future_role_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  future_role_id UUID REFERENCES public.future_roles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(future_role_id, user_id)
);

CREATE INDEX idx_future_role_subs_role ON public.future_role_subscriptions(future_role_id);
CREATE INDEX idx_future_role_subs_user ON public.future_role_subscriptions(user_id);

ALTER TABLE public.future_role_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member manages own subscription" ON public.future_role_subscriptions
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND future_role_id IN (SELECT id FROM public.future_roles WHERE status = 'open')
  );

CREATE POLICY "Employer sees subscribers to own roles" ON public.future_role_subscriptions
  FOR SELECT USING (
    future_role_id IN (
      SELECT id FROM public.future_roles
      WHERE company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
    )
  );

-- ------------------------------------------------------------
-- Member-stated future interests -- the secondary AI-matching signal,
-- distinct from an explicit per-role subscription. Free-text note plus
-- a light tag array, mirroring profile_skills' (054) shape without
-- reusing that exact table, since "where I want to be in a year" is a
-- different kind of claim than "skills I already have".
-- ------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN future_interests TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN future_interests_note TEXT;

-- Extend platform_people_index (060) with the new trajectory signal so
-- Longlist's AI matching can query one place, same as every other
-- cross-pillar person lookup. profiles is already broadly readable
-- (this view's own original comment), so this is not a new exposure --
-- future_interests/future_interests_note are exactly as public as
-- full_name/location already were on this view.
CREATE OR REPLACE VIEW public.platform_people_index AS
SELECT
  p.id AS user_id,
  p.full_name,
  p.location,
  gs.greyin_score,
  COALESCE(gs.is_verified_expert, false) AS is_verified_expert,
  COALESCE(vo.verified_outcomes_count, 0) AS verified_outcomes_count,
  COALESCE(ps.skills, ARRAY[]::text[]) AS skills,
  c.availability,
  c.current_title,
  p.is_mentor,
  p.mentor_domain,
  p.future_interests,
  p.future_interests_note
FROM public.profiles p
LEFT JOIN public.greyin_scores gs ON gs.user_id = p.id
LEFT JOIN public.candidates c ON c.user_id = p.id
LEFT JOIN (
  SELECT subject_user_id, COUNT(*) AS verified_outcomes_count
  FROM public.verified_outcomes
  WHERE status = 'verified'
  GROUP BY subject_user_id
) vo ON vo.subject_user_id = p.id
LEFT JOIN (
  SELECT user_id, array_agg(skill ORDER BY skill) AS skills
  FROM public.profile_skills
  GROUP BY user_id
) ps ON ps.user_id = p.id;

GRANT SELECT ON public.platform_people_index TO authenticated;

-- ------------------------------------------------------------
-- llm_feature_flags: the AI-matching flag Longlist's second candidate
-- set rides on, same shared provider pool as every other AI feature
-- (048). Defaults OFF, unlike the quality-scoring flags that shipped
-- enabled -- this one surfaces real candidate profiles to an employer
-- who never received a subscription, a more sensitive default than a
-- quality score, so it starts admin-gated until explicitly turned on
-- from Greyin Hub's /admin/llm.
-- ------------------------------------------------------------
INSERT INTO public.llm_feature_flags (feature_key, enabled) VALUES
  ('longlist_candidate_matching', false);

-- ------------------------------------------------------------
-- Notifications -- same SECURITY DEFINER trigger convention as 017/051.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_future_role_subscribed()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_id UUID;
  v_title TEXT;
BEGIN
  SELECT fr.posted_by, fr.title INTO v_owner_id, v_title
  FROM future_roles fr WHERE fr.id = NEW.future_role_id;

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (v_owner_id, 'future_role_subscribed', 'A member is future-interested',
            'Someone subscribed to "' || v_title || '" as future-interested', '/roles/' || NEW.future_role_id || '/candidates');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_future_role_subscribed
  AFTER INSERT ON public.future_role_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_future_role_subscribed();

CREATE OR REPLACE FUNCTION public.notify_future_role_filled()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'filled' AND OLD.status = 'open' THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT frs.user_id, 'future_role_filled', 'A role you were interested in has moved on',
           '"' || NEW.title || '" is no longer open on Longlist', '/roles'
    FROM future_role_subscriptions frs WHERE frs.future_role_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_future_role_filled
  AFTER UPDATE ON public.future_roles
  FOR EACH ROW EXECUTE FUNCTION public.notify_future_role_filled();

-- ------------------------------------------------------------
-- pillar_memberships (022, extended 047) -- add 'longlist' to the
-- allowed pillar set so Longlist's login route can call
-- ensure_pillar_membership('longlist', ...) like every other app does.
-- Deliberately NOT touching handle_email_confirmed() here -- that
-- trigger's role->pillar CASE has already regressed once this session
-- (069) from an edit that looked safe; Longlist's signup uses the same
-- base 'candidate' role as ExpertEdge with no distinct role value of
-- its own; the login-route RPC path (022's own comment: signup-time
-- backfill is a belt-and-suspenders nicety, not a requirement) is
-- sufficient on its own and carries none of that risk.
-- ------------------------------------------------------------
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name FROM pg_constraint
  WHERE conrelid = 'public.pillar_memberships'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%pillar%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pillar_memberships DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.pillar_memberships
  ADD CONSTRAINT pillar_memberships_pillar_check
  CHECK (pillar = ANY (ARRAY['greyin', 'greymatters', 'saltnpepper', 'freeagent', 'stackedge', 'longlist']));

CREATE POLICY "Anyone authenticated can view longlist pillar memberships"
  ON public.pillar_memberships FOR SELECT
  USING (auth.role() = 'authenticated' AND pillar = 'longlist');

NOTIFY pgrst, 'reload schema';
