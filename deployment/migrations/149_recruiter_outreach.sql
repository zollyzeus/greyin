-- ============================================================
-- Feature 1 of the Skillmeet.ai comparison round (2026-09-12):
-- recruiter-initiated outreach + score-based ranking on DeepEdge's
-- existing Talent Search.
-- ============================================================
--
-- search_verified_candidates() (107) already restricts the pool to
-- is_verified_expert=true and already returns greyin_score per row, but
-- never let a caller filter/sort by it -- results were plain
-- created_at DESC. Adding p_min_score (NULL-safe, same pattern as the
-- other optional filters) and switching the default order to
-- greyin_score DESC so the highest-signal candidates surface first,
-- matching the "companies scout ranked candidates" mechanic Skillmeet
-- built its recruiter hub around.
--
-- job_invites is new: today an employer can only ever be reached BY a
-- candidate applying; there is no way for an employer to proactively
-- invite a specific searched candidate to a specific one of their own
-- job postings. subscription_tier_credits already seeds a 'job_invite'
-- credit_type (096) but nothing has ever consumed it -- this migration
-- is what finally wires that dormant credit type to a real action.
-- ============================================================

-- CREATE OR REPLACE can't change a function's argument list -- adding
-- p_min_score would otherwise leave the old 4-arg signature behind as a
-- second, dead overload, and then make the GRANT below ambiguous.
DROP FUNCTION IF EXISTS public.search_verified_candidates(text, int, text, text);

CREATE FUNCTION public.search_verified_candidates(
  p_skill text DEFAULT NULL,
  p_min_experience int DEFAULT NULL,
  p_availability text DEFAULT NULL,
  p_remote_preference text DEFAULT NULL,
  p_min_score numeric DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  current_title text,
  skills text[],
  experience_years int,
  availability text,
  remote_preference text,
  greyin_score numeric,
  full_name text,
  location text,
  avatar_url text,
  is_reentry boolean,
  reentry_reason text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.user_id,
    c.current_title,
    c.skills,
    c.experience_years,
    c.availability,
    c.remote_preference,
    gs.greyin_score,
    p.full_name,
    p.location,
    p.avatar_url,
    p.is_reentry,
    p.reentry_reason
  FROM public.candidates c
  JOIN public.greyin_scores gs ON gs.user_id = c.user_id
  JOIN public.profiles p ON p.id = c.user_id
  WHERE gs.is_verified_expert = true
    AND COALESCE(p.is_pivoter, false) = false
    AND (p_skill IS NULL OR c.skills @> ARRAY[p_skill])
    AND (p_min_experience IS NULL OR c.experience_years >= p_min_experience)
    AND (p_availability IS NULL OR c.availability = p_availability)
    AND (p_remote_preference IS NULL OR c.remote_preference = p_remote_preference)
    -- COALESCE to 0 matters: greyin_score is NULL for a verified expert
    -- who qualifies purely via years_experience with zero pillar
    -- evidence yet (041's CASE WHEN ... all-NULL branch) -- without it,
    -- even p_min_score=0 would silently exclude every such candidate
    -- instead of correctly including everyone.
    AND (p_min_score IS NULL OR COALESCE(gs.greyin_score, 0) >= p_min_score)
  ORDER BY gs.greyin_score DESC NULLS LAST, c.created_at DESC
  LIMIT 50
$$;

GRANT EXECUTE ON FUNCTION public.search_verified_candidates TO authenticated;

CREATE TABLE public.job_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_user_id)
);

ALTER TABLE public.job_invites ENABLE ROW LEVEL SECURITY;

-- Employer can see/create invites for their own jobs only.
CREATE POLICY "Employers manage invites for their own jobs"
  ON public.job_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j JOIN public.companies co ON co.id = j.company_id
      WHERE j.id = job_invites.job_id AND co.user_id = auth.uid()
    )
  )
  WITH CHECK (
    invited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.jobs j JOIN public.companies co ON co.id = j.company_id
      WHERE j.id = job_invites.job_id AND co.user_id = auth.uid()
    )
  );

-- The invited candidate can see invites addressed to them.
CREATE POLICY "Candidates view their own invites"
  ON public.job_invites FOR SELECT
  USING (candidate_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_job_invite()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job_title TEXT;
  v_company_name TEXT;
BEGIN
  SELECT j.title, co.name INTO v_job_title, v_company_name
  FROM public.jobs j JOIN public.companies co ON co.id = j.company_id
  WHERE j.id = NEW.job_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.candidate_user_id,
    'job_invite',
    'You were invited to apply',
    COALESCE(v_company_name, 'An employer') || ' invited you to apply for "' || COALESCE(v_job_title, 'a role') || '"',
    '/jobs/' || NEW.job_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_job_invite_created
  AFTER INSERT ON public.job_invites
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_invite();
