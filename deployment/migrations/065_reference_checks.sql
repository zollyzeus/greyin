-- ============================================================
-- 1. Gate written_recommendations to a real, verified interaction
-- ============================================================
--
-- Left open when 064 gated skill_endorsements and the Greyin Score's
-- saltnpepper input to real interactions -- same open/self-report gap
-- (any authenticated user, zero interaction), just missed in that pass.
-- Same fix, same evidence: the collaborators view (059).
-- ============================================================

DROP POLICY "Any authenticated user can write a recommendation" ON public.written_recommendations;

CREATE POLICY "Only real collaborators can write a recommendation"
  ON public.written_recommendations FOR INSERT
  WITH CHECK (
    auth.uid() = recommender_id
    AND recommender_id <> recommendee_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.collaborators
      WHERE collaborators.user_id = auth.uid() AND collaborators.collaborator_id = written_recommendations.recommendee_id
    )
  );

-- ============================================================
-- 2. Employer-initiated private reference checks
-- ============================================================
--
-- Deliberately NOT gated to collaborators, unlike endorsements/
-- recommendations above -- a reference's whole point is often
-- corroborating something *outside* what Greyin ever saw (a past job,
-- not a platform transaction), so requiring a collaborators row would
-- make it redundant with what endorsements already cover. The
-- evidentiary weight instead comes from the request/response structure:
-- the employer asks directly, the candidate can never see or edit the
-- response (see reference_responses RLS below), and the relationship is
-- explicitly typed rather than left to inference. Any real in-platform
-- tie (collaborators) is additive context the app layer surfaces
-- alongside the self-reported relationship, not a gate on it.
--
-- Three tables:
--   professional_references -- a candidate's own curated reference list
--   reference_requests      -- an employer's request against one entry,
--                              tied to a real application (only writable
--                              via create_reference_request(), not raw
--                              INSERT -- the eligibility check spans 4
--                              tables and doesn't fit a WITH CHECK clause)
--   reference_responses     -- the referee's private, one-time answer
--
-- Run this after 064_ethos_verification_gates.sql
-- ============================================================

CREATE TABLE public.professional_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reference_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('in_platform_task', 'ex_colleague', 'current_colleague', 'other')),
  relationship_detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT professional_references_no_self_reference CHECK (candidate_id <> reference_user_id),
  UNIQUE(candidate_id, reference_user_id)
);

CREATE INDEX idx_professional_references_candidate ON public.professional_references(candidate_id);
CREATE INDEX idx_professional_references_reference_user ON public.professional_references(reference_user_id);

ALTER TABLE public.professional_references ENABLE ROW LEVEL SECURITY;

-- Visible to: the candidate who listed it, the person named as the
-- reference (so they know they've been listed), and only employers who
-- have a real applicant relationship with this candidate -- same
-- eligibility shape as company_reviews (058): a real applications row,
-- not open to any authenticated user, since this exposes another real
-- person's identity and relationship to the candidate.
CREATE POLICY "Candidate, referee, and applicant-employers can view"
  ON public.professional_references FOR SELECT
  USING (
    auth.uid() = candidate_id
    OR auth.uid() = reference_user_id
    OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      JOIN public.companies c ON c.id = j.company_id
      JOIN public.candidates cand ON cand.id = a.candidate_id
      WHERE cand.user_id = professional_references.candidate_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Candidates manage their own reference list"
  ON public.professional_references FOR INSERT
  WITH CHECK (auth.uid() = candidate_id);

CREATE POLICY "Candidates can remove their own references"
  ON public.professional_references FOR DELETE
  USING (auth.uid() = candidate_id);

GRANT SELECT, INSERT, DELETE ON public.professional_references TO authenticated;

CREATE TABLE public.reference_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_id UUID NOT NULL REFERENCES public.professional_references(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reference_id, application_id)
);

CREATE INDEX idx_reference_requests_reference ON public.reference_requests(reference_id);
CREATE INDEX idx_reference_requests_requested_by ON public.reference_requests(requested_by);

ALTER TABLE public.reference_requests ENABLE ROW LEVEL SECURITY;

-- No INSERT policy on purpose -- the eligibility check (requester owns
-- the company on this exact application, and this reference belongs to
-- that same application's candidate) spans applications/jobs/companies/
-- professional_references and doesn't fit a single-table WITH CHECK.
-- create_reference_request() below is the only path in; RLS blocking
-- direct INSERT is what makes that the only path, not just convention.
CREATE POLICY "Requesting employer and the named referee can view requests"
  ON public.reference_requests FOR SELECT
  USING (
    auth.uid() = requested_by
    OR EXISTS (
      SELECT 1 FROM public.professional_references pr
      WHERE pr.id = reference_requests.reference_id AND pr.reference_user_id = auth.uid()
    )
  );

GRANT SELECT ON public.reference_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.create_reference_request(p_reference_id UUID, p_application_id UUID)
RETURNS UUID
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request_id UUID;
  v_reference_candidate_id UUID;
  v_app_candidate_user_id UUID;
  v_app_company_owner UUID;
BEGIN
  SELECT candidate_id INTO v_reference_candidate_id
  FROM professional_references WHERE id = p_reference_id;
  IF v_reference_candidate_id IS NULL THEN
    RAISE EXCEPTION 'Reference not found';
  END IF;

  SELECT cand.user_id, c.user_id INTO v_app_candidate_user_id, v_app_company_owner
  FROM applications a
  JOIN jobs j ON j.id = a.job_id
  JOIN companies c ON c.id = j.company_id
  JOIN candidates cand ON cand.id = a.candidate_id
  WHERE a.id = p_application_id;

  IF v_app_company_owner IS NULL OR v_app_company_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to request a reference for this application';
  END IF;
  IF v_app_candidate_user_id IS DISTINCT FROM v_reference_candidate_id THEN
    RAISE EXCEPTION 'This reference does not belong to this application''s candidate';
  END IF;

  INSERT INTO reference_requests (reference_id, requested_by, application_id)
  VALUES (p_reference_id, auth.uid(), p_application_id)
  RETURNING id INTO v_request_id;

  INSERT INTO notifications (user_id, type, title, body, link)
  SELECT pr.reference_user_id, 'reference_request', 'Reference request',
         COALESCE(cp.full_name, 'Someone') || ' asked you to be a reference for ' || COALESCE(candp.full_name, 'a candidate'),
         '/references/respond'
  FROM professional_references pr
  JOIN profiles cp ON cp.id = auth.uid()
  JOIN profiles candp ON candp.id = pr.candidate_id
  WHERE pr.id = p_reference_id;

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.create_reference_request(UUID, UUID) TO authenticated;

CREATE TABLE public.reference_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.reference_requests(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reference_responses ENABLE ROW LEVEL SECURITY;

-- The candidate is deliberately never a party to either policy here --
-- the whole point of an employer-initiated reference is that the
-- candidate can't see, edit, or filter the answer.
CREATE POLICY "Requesting employer and the responder can view the response"
  ON public.reference_responses FOR SELECT
  USING (
    auth.uid() = responder_id
    OR EXISTS (
      SELECT 1 FROM public.reference_requests rr
      WHERE rr.id = reference_responses.request_id AND rr.requested_by = auth.uid()
    )
  );

CREATE POLICY "Only the named referee can respond to their own pending request"
  ON public.reference_responses FOR INSERT
  WITH CHECK (
    auth.uid() = responder_id
    AND EXISTS (
      SELECT 1 FROM public.reference_requests rr
      JOIN public.professional_references pr ON pr.id = rr.reference_id
      WHERE rr.id = reference_responses.request_id
        AND pr.reference_user_id = auth.uid()
        AND rr.status = 'pending'
    )
  );

GRANT SELECT, INSERT ON public.reference_responses TO authenticated;

CREATE OR REPLACE FUNCTION public.on_reference_response_submitted()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_requested_by UUID;
BEGIN
  UPDATE reference_requests SET status = 'responded' WHERE id = NEW.request_id
  RETURNING requested_by INTO v_requested_by;

  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (v_requested_by, 'reference_responded', 'Reference response received',
          'A reference you requested has responded', '/candidates');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_reference_response_created
  AFTER INSERT ON public.reference_responses
  FOR EACH ROW EXECUTE FUNCTION public.on_reference_response_submitted();

NOTIFY pgrst, 'reload schema';
