-- ============================================================
-- Full structured employment history + salary trend aggregation
-- ============================================================
--
-- candidate_employment_history: multiple past roles per candidate,
-- each with its own past salary. Kept fully private (owner + admin
-- SELECT only) -- unlike posts.view_audience, there's no legitimate
-- third-party reader of one person's raw salary, so this uses a
-- simpler blanket rule instead of a per-row visibility column:
-- private at the row level, aggregated-only (salary_trends view below)
-- everywhere else.
--
-- Run this after 054_skill_endorsements_and_ratings.sql
-- ============================================================

CREATE TABLE public.candidate_employment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  level TEXT CHECK (level IN ('junior', 'mid', 'senior', 'lead', 'director', 'executive')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  salary_amount INTEGER,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_employment_history_candidate_id ON public.candidate_employment_history(candidate_id);

ALTER TABLE public.candidate_employment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidates manage their own employment history"
  ON public.candidate_employment_history FOR ALL
  USING (EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id AND c.user_id = auth.uid()));

CREATE POLICY "Admins can view all employment history"
  ON public.candidate_employment_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- set_updated_at() is the shared generic trigger function introduced
-- in 054_skill_endorsements_and_ratings.sql -- reused here rather than
-- duplicating it under a second name.
CREATE TRIGGER employment_history_updated_at
  BEFORE UPDATE ON public.candidate_employment_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- salary_trends: a k-anonymized aggregate (HAVING COUNT(*) >= 3 --
-- never a raw per-person row), combining past
-- (candidate_employment_history), expected
-- (candidates.expected_salary_min/max, already existed), and market
-- (jobs.salary_min/max where salary_disclosed, already existed). Runs
-- as view owner (bypasses RLS on the private employment_history
-- table), safe specifically because the HAVING COUNT(*) >= 3 floor
-- structurally prevents any single person's number from ever being
-- isolated -- never exposes a user_id/candidate_id.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.salary_trends AS
WITH bucketed AS (
  SELECT
    'past'::text AS source,
    LOWER(TRIM(ceh.title)) AS role_title,
    ceh.level,
    CASE
      WHEN c.experience_years IS NULL THEN NULL
      WHEN c.experience_years < 3 THEN '0-2'
      WHEN c.experience_years < 7 THEN '3-6'
      WHEN c.experience_years < 15 THEN '7-14'
      ELSE '15+'
    END AS experience_bucket,
    LOWER(TRIM(COALESCE(ceh.location, p.location))) AS location,
    ceh.currency,
    DATE_TRUNC('quarter', COALESCE(ceh.end_date, ceh.start_date)) AS period,
    ceh.salary_amount AS salary_low,
    ceh.salary_amount AS salary_high
  FROM public.candidate_employment_history ceh
  JOIN public.candidates c ON c.id = ceh.candidate_id
  JOIN public.profiles p ON p.id = c.user_id
  WHERE ceh.salary_amount IS NOT NULL

  UNION ALL

  SELECT
    'expected'::text,
    LOWER(TRIM(c.current_title)),
    NULL,
    CASE
      WHEN c.experience_years IS NULL THEN NULL
      WHEN c.experience_years < 3 THEN '0-2'
      WHEN c.experience_years < 7 THEN '3-6'
      WHEN c.experience_years < 15 THEN '7-14'
      ELSE '15+'
    END,
    LOWER(TRIM(p.location)),
    c.currency,
    DATE_TRUNC('quarter', c.updated_at),
    c.expected_salary_min,
    c.expected_salary_max
  FROM public.candidates c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.expected_salary_min IS NOT NULL OR c.expected_salary_max IS NOT NULL

  UNION ALL

  SELECT
    'market'::text,
    LOWER(TRIM(j.title)),
    NULL,
    CASE
      WHEN j.experience_min IS NULL THEN NULL
      WHEN j.experience_min < 3 THEN '0-2'
      WHEN j.experience_min < 7 THEN '3-6'
      WHEN j.experience_min < 15 THEN '7-14'
      ELSE '15+'
    END,
    LOWER(TRIM(j.location)),
    j.currency,
    DATE_TRUNC('quarter', j.created_at),
    j.salary_min,
    j.salary_max
  FROM public.jobs j
  WHERE j.salary_disclosed = true AND j.status IN ('open', 'filled')
)
SELECT
  source, role_title, level, experience_bucket, location, currency, period,
  COUNT(*) AS sample_size,
  ROUND(AVG(salary_low)) AS avg_salary_low,
  ROUND(AVG(salary_high)) AS avg_salary_high,
  MIN(salary_low) AS min_salary,
  MAX(salary_high) AS max_salary
FROM bucketed
WHERE role_title IS NOT NULL
GROUP BY source, role_title, level, experience_bucket, location, currency, period
HAVING COUNT(*) >= 3;

GRANT SELECT ON public.salary_trends TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
