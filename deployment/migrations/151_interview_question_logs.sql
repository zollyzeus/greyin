-- ============================================================
-- Feature 3 of the Skillmeet.ai comparison round (2026-09-12):
-- crowdsourced real interview-question corpus, feeding the existing AI
-- interview-prep generator (Phase B1, apps/deepedge/src/lib/interview-prep.ts).
-- ============================================================
--
-- Today's AI interview prep is purely generic LLM output grounded only
-- in the job description + candidate profile -- no real "what does this
-- company actually ask" data exists anywhere. Skillmeet's Locus agent's
-- real edge is exactly this: a corpus of real reported questions ranked
-- by company. This migration adds the write path; interview-prep.ts is
-- updated separately (app code) to read from it.
--
-- Eligibility mirrors company_reviews' (058) "real application tie"
-- shape: a candidate may submit a question log for a company only if
-- they have a real applications row against one of that company's jobs
-- that has reached at least the 'interview' stage -- the same
-- CHECK-valid status values applications.status already uses (001).
-- ============================================================

CREATE TABLE public.interview_question_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  round_label TEXT,
  question_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interview_question_logs_company ON public.interview_question_logs(company_id, created_at DESC);

ALTER TABLE public.interview_question_logs ENABLE ROW LEVEL SECURITY;

-- Readable by any authenticated user -- the value of the corpus is in
-- being widely visible to future candidates, same "everyone benefits
-- from everyone else's real signal" shape as company_reviews.
CREATE POLICY "Authenticated users can read interview question logs"
  ON public.interview_question_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Candidates who reached interview stage can submit questions"
  ON public.interview_question_logs FOR INSERT
  WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      JOIN public.candidates c ON c.id = a.candidate_id
      WHERE j.company_id = interview_question_logs.company_id
        AND c.user_id = auth.uid()
        AND a.status IN ('interview', 'offer', 'rejected', 'accepted')
    )
  );
