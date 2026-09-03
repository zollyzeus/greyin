-- ============================================================
-- Fix a real regression from 067's company_reviews column REVOKE
-- ============================================================
--
-- SEC-020's fix (067) correctly revoked broad SELECT on reviewer_id to
-- close the de-anonymization vector -- but apps/greyin-b2b/src/app/
-- companies/[id]/page.tsx:66 legitimately needs to check "does a row
-- with MY OWN reviewer_id already exist" to show "You've already
-- reviewed this company." Column-level GRANT/REVOKE applies to any use
-- of the column, including inside a WHERE filter, not just the SELECT
-- list -- that query started failing outright (caught by company-
-- reviews.spec.ts). Re-granting SELECT on reviewer_id broadly would
-- undo the whole fix (PostgREST's ?select=reviewer_id would work again
-- for anyone). A narrow SECURITY DEFINER RPC lets a user check only
-- their own membership in the table without ever exposing the column
-- through a general grant.
--
-- Run this after 071_private_resumes_bucket.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_reviewed_company(p_company_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_reviews
    WHERE company_id = p_company_id AND reviewer_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

GRANT EXECUTE ON FUNCTION public.has_reviewed_company(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
