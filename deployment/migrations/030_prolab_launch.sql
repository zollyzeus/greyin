-- ============================================================
-- Prolab launch (Phase 0)
-- ============================================================
--
-- Carves "The Lab" out of Salt & Pepper into its own app at
-- prolab.greyin.net. builder_projects/project_upvotes (009) are reused
-- as-is -- no data migration. This adds the structured ask/application
-- model that replaces builder_projects.looking_for (left in place,
-- deprecated, not dropped), the project_updates gap (builder_projects
-- has never had comments), a schema-only verified_outcomes table for
-- later-phase AI verification / cross-product leaderboards, and the
-- profiles/trigger/pillar_memberships plumbing needed for
-- Builder-vs-Supporter identity.
--
-- FK note: every new table below references public.profiles(id), not
-- auth.users -- see 011_fix_saltnpepper_profile_fks.sql, which had to
-- retrofit this for discussions/builder_projects because PostgREST can
-- only resolve an embedded `profiles:col(...)` select through a real FK
-- to profiles. Getting this wrong here would repeat that exact bug.
--
-- Run this after 029_freeagent_upwork_workflow.sql
-- ============================================================

-- ------------------------------------------------------------
-- profiles: prolab_role + widen role check for 'supporter'
-- ------------------------------------------------------------
-- 'member' is deliberately reused for the Builder track (same 12+-year
-- population as Salt & Pepper). 'supporter' is new: the ungated track
-- must NOT collide with 'member', since saltnpepper-community's
-- /members page filters role='member' and assumes that means the 12+
-- year gate was passed.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prolab_role TEXT CHECK (prolab_role IN ('builder', 'supporter'));

COMMENT ON COLUMN public.profiles.prolab_role IS
  'Which track the user chose when signing up directly on prolab.greyin.net. NULL for users who only ever reached prolab via SSO from another pillar (e.g. an existing Salt & Pepper member) -- their Builder eligibility is derived from years_experience >= 12 instead, not this column.';

DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%'
    AND pg_get_constraintdef(oid) NOT LIKE '%prolab_role%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('candidate', 'client', 'freelancer', 'admin', 'author', 'employer', 'member', 'supporter'));

COMMENT ON COLUMN public.builder_projects.looking_for IS
  'Deprecated as of the prolab launch (030) -- superseded by structured project_asks. Left in place (not dropped) for existing rows; no longer written by any app.';

-- ------------------------------------------------------------
-- project_asks: structured replacement for builder_projects.looking_for
-- ------------------------------------------------------------
CREATE TABLE public.project_asks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.builder_projects ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  role_title TEXT NOT NULL,
  skills TEXT[] DEFAULT '{}',
  description TEXT,
  status TEXT CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.project_asks IS 'Prolab: structured role+skills asks posted by a project''s Builder owner';

ALTER TABLE public.project_asks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view asks"
  ON public.project_asks FOR SELECT
  USING (auth.role() = 'authenticated');

-- Defense in depth: mirrors the isBuilder() check the app already makes
-- before rendering the "post an ask" form, plus ownership of the project.
CREATE POLICY "Project owners who are Builders can create asks"
  ON public.project_asks FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM public.builder_projects WHERE id = project_id AND user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (years_experience >= 12 OR prolab_role = 'builder')
    )
  );

CREATE POLICY "Owners can update their own asks"
  ON public.project_asks FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Admins can delete any ask"
  ON public.project_asks FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX idx_project_asks_project_id ON public.project_asks(project_id);
CREATE INDEX idx_project_asks_status ON public.project_asks(status);

-- ------------------------------------------------------------
-- project_applications: someone applying to an ask
-- ------------------------------------------------------------
CREATE TABLE public.project_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ask_id UUID REFERENCES public.project_asks ON DELETE CASCADE NOT NULL,
  applicant_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  pitch TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ask_id, applicant_id)
);

COMMENT ON TABLE public.project_applications IS 'Prolab: an applicant''s pitch for a specific project_ask, and the Builder''s accept/decline decision';

ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;

-- Deliberately no gate beyond "authenticated" -- Builders and Supporters
-- alike may apply to asks (Phase 0 design decision #6); the ungated
-- Supporter track only affects signup, not who may apply once inside.
CREATE POLICY "Applicants and the ask's project owner can view applications"
  ON public.project_applications FOR SELECT
  USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM public.project_asks pa
      JOIN public.builder_projects bp ON bp.id = pa.project_id
      WHERE pa.id = ask_id AND bp.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can apply"
  ON public.project_applications FOR INSERT
  WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "The ask's project owner can update application status"
  ON public.project_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_asks pa
      JOIN public.builder_projects bp ON bp.id = pa.project_id
      WHERE pa.id = ask_id AND bp.user_id = auth.uid()
    )
  );

CREATE INDEX idx_project_applications_ask_id ON public.project_applications(ask_id);
CREATE INDEX idx_project_applications_applicant_id ON public.project_applications(applicant_id);

-- ------------------------------------------------------------
-- project_updates: the "no comments" gap on builder_projects
-- ------------------------------------------------------------
CREATE TABLE public.project_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.builder_projects ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.project_updates IS 'Prolab: devlog-style updates posted by a project''s Builder owner (append-only, not open community comments)';

ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view project updates"
  ON public.project_updates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Project owners can post updates"
  ON public.project_updates FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM public.builder_projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can delete any project update"
  ON public.project_updates FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX idx_project_updates_project_id ON public.project_updates(project_id);

-- ------------------------------------------------------------
-- verified_outcomes: schema-only groundwork for later phases
-- ------------------------------------------------------------
-- The AI-check/human-review workflow that POPULATES this is explicitly
-- out of scope for Phase 0. This just needs the right shape so a later
-- phase can add routes/logic against it without another blocking
-- migration. Modeled around project_applications (the concrete unit of
-- "a collaboration actually happened"), with project_id denormalized for
-- cheap leaderboard-style queries later.
CREATE TABLE public.verified_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_user_id UUID REFERENCES public.profiles ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.builder_projects ON DELETE CASCADE,
  application_id UUID REFERENCES public.project_applications ON DELETE CASCADE,
  outcome_type TEXT CHECK (outcome_type IN ('project_shipped', 'collaboration_completed')) NOT NULL,
  evidence_url TEXT,
  status TEXT CHECK (status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
  verification_method TEXT,
  verified_by UUID REFERENCES public.profiles,
  verified_at TIMESTAMPTZ,
  score NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.verified_outcomes IS 'Groundwork for the later-phase AI-assisted verification pipeline and cross-product leaderboards. Phase 0 creates the shape only; nothing in Phase 0 writes to this table.';

ALTER TABLE public.verified_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subjects can view their own outcomes; everyone can view verified ones"
  ON public.verified_outcomes FOR SELECT
  USING (auth.role() = 'authenticated' AND (status = 'verified' OR auth.uid() = subject_user_id));

-- No app-level writer exists yet in Phase 0 -- these exist so a later
-- phase's admin/human-review UI (or a service-role-driven AI pipeline)
-- can start writing immediately without another RLS migration.
CREATE POLICY "Admins can insert verified outcomes"
  ON public.verified_outcomes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update verified outcomes"
  ON public.verified_outcomes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX idx_verified_outcomes_subject_user_id ON public.verified_outcomes(subject_user_id);
CREATE INDEX idx_verified_outcomes_status ON public.verified_outcomes(status);

-- ------------------------------------------------------------
-- handle_email_confirmed(): extend to persist prolab_role + pillar
-- ------------------------------------------------------------
-- Same function as 022's version, plus: persist prolab_role from
-- raw_user_meta_data, and record a *second*, independent
-- pillar_memberships row for 'prolab' whenever prolab_role was set --
-- independent of the existing role-based CASE below, since a Builder
-- signup sets role='member' (-> 'saltnpepper' pillar) AND
-- prolab_role='builder' (-> 'prolab' pillar) simultaneously; both are
-- true at once and should both be recorded.
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  meta JSONB := NEW.raw_user_meta_data;
  user_role TEXT := COALESCE(meta->>'role', 'candidate');
  full_name TEXT := trim(concat(meta->>'first_name', ' ', meta->>'last_name'));
  v_pillar TEXT;
  v_prolab_role TEXT := meta->>'prolab_role';
BEGIN
  IF NEW.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, years_experience, prolab_role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(full_name, ''),
    user_role,
    NULLIF(meta->>'years_experience', '')::INTEGER,
    v_prolab_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role = EXCLUDED.role,
    years_experience = COALESCE(EXCLUDED.years_experience, public.profiles.years_experience),
    prolab_role = COALESCE(EXCLUDED.prolab_role, public.profiles.prolab_role),
    updated_at = NOW();

  IF user_role = 'employer' THEN
    INSERT INTO public.companies (user_id, name, slug)
    VALUES (
      NEW.id,
      COALESCE(NULLIF(full_name, ''), NEW.email) || '''s Company',
      'company-' || substr(NEW.id::text, 1, 8)
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF user_role = 'candidate' THEN
    INSERT INTO public.candidates (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  v_pillar := CASE
    WHEN user_role IN ('candidate', 'employer') THEN 'greyin'
    WHEN user_role IN ('client', 'freelancer') THEN 'freeagent'
    WHEN user_role = 'member' THEN 'saltnpepper'
    WHEN user_role = 'author' THEN 'greymatters'
  END;
  IF v_pillar IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, v_pillar, user_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  IF v_prolab_role IS NOT NULL THEN
    INSERT INTO public.pillar_memberships (user_id, pillar, role)
    VALUES (NEW.id, 'prolab', v_prolab_role)
    ON CONFLICT (user_id, pillar) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- pillar_memberships: widen for 'prolab'
-- ------------------------------------------------------------
-- Used by prolab's login route's ensure_pillar_membership call, which is
-- what registers an *existing* Salt & Pepper member as an active prolab
-- participant on first login -- no fresh prolab signup required for them.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.pillar_memberships'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%pillar%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pillar_memberships DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.pillar_memberships
  ADD CONSTRAINT pillar_memberships_pillar_check
  CHECK (pillar = ANY (ARRAY['greyin', 'greymatters', 'saltnpepper', 'freeagent', 'prolab']));

NOTIFY pgrst, 'reload schema';
