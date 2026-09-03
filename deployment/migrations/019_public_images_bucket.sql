-- ============================================================
-- Public image uploads (GreyMatters post covers, FreeAgent gig images)
-- ============================================================
--
-- Both were URL-paste-only (or missing entirely — the post CMS built in
-- the prior session didn't even expose cover_image_url, and gigs/new never
-- had an images field at all). A public bucket lets the browser upload
-- directly via supabase-js and get back a stable public URL to store.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('public-images', 'public-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view public images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'public-images');

CREATE POLICY "Authenticated users can upload public images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'public-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update their own public images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'public-images' AND owner = auth.uid());

CREATE POLICY "Authenticated users can delete their own public images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'public-images' AND owner = auth.uid());
