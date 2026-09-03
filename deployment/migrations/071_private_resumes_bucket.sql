-- ============================================================
-- SEC-009 / SEC-010: private, path-scoped, validated resume storage
-- ============================================================
--
-- Resumes were stored in `public-images` (019) -- public:true, listable
-- by anyone unauthenticated, no path scoping on INSERT (any logged-in
-- user could write to any path, including another user's), no MIME
-- allowlist, no size limit. A new dedicated bucket fixes all four at
-- once; `public-images` itself is also hardened for its own legitimate
-- use (post covers, gig images) since it had the same missing
-- path-scoping/validation gaps.
--
-- Run this after 070_fix_profile_role_trigger_exemption.sql
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('resumes', 'resumes', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Owner can manage their own resume; an employer with a real
-- application from that candidate can read it -- same eligibility
-- shape as company_reviews (058) and professional_references (065):
-- a real applications row, not an open grant.
CREATE POLICY "Owner and applicant-employers can view resumes"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.applications a
        JOIN public.jobs j ON j.id = a.job_id
        JOIN public.companies c ON c.id = j.company_id
        JOIN public.candidates cand ON cand.id = a.candidate_id
        WHERE cand.user_id::text = (storage.foldername(name))[1] AND c.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owner can upload their own resume"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner can replace their own resume"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner can delete their own resume"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------
-- Harden public-images for its own legitimate use (genuinely public
-- post covers / gig images) -- same missing gaps, lower severity since
-- nothing sensitive belongs here once resumes move out, but still a
-- real stored-content/storage-exhaustion risk without these.
-- ------------------------------------------------------------
UPDATE storage.buckets
SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'public-images';

DROP POLICY IF EXISTS "Authenticated users can upload public images" ON storage.objects;
CREATE POLICY "Authenticated users can upload their own public images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'public-images' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);

NOTIFY pgrst, 'reload schema';
