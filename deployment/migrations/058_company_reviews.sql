-- ============================================================
-- Verified-reviewer company reviews (Glassdoor-style, anonymous
-- display, real-application eligibility)
-- ============================================================
--
-- Anonymity here is an APP-LAYER display choice, not an access-control
-- one: reviewer_id exists purely for the eligibility check (did this
-- person really apply to a job at this company) and the one-review-
-- per-company uniqueness constraint. No app code ever selects/joins
-- reviewer_id for display -- see companies/[id]/page.tsx, which reads
-- only rating/review_text/created_at.
--
-- Run this after 057_written_recommendations.sql
-- ============================================================

CREATE TABLE public.company_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, reviewer_id)
);

CREATE INDEX idx_company_reviews_company_id ON public.company_reviews(company_id);

ALTER TABLE public.company_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company reviews are viewable by everyone"
  ON public.company_reviews FOR SELECT
  USING (true);

-- Eligibility: a real application on record for a job at this company,
-- via this reviewer's own candidates row.
CREATE POLICY "Candidates who applied can review that company"
  ON public.company_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      JOIN public.candidates c ON c.id = a.candidate_id
      WHERE j.company_id = company_reviews.company_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete any company review"
  ON public.company_reviews FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

NOTIFY pgrst, 'reload schema';
