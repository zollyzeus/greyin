-- ============================================================
-- Admin moderation RLS policies
-- ============================================================
--
-- profiles.role already allows 'admin' (see 001_initial_schema.sql), and
-- `comments` already has admin UPDATE/DELETE policies from day one — but no
-- frontend admin surface was ever built, and several other tables that
-- clearly need the same moderation override (jobs, gigs, posts, discussions,
-- builder_projects) never got the matching policies added. Mirrors the
-- existing comments admin-policy pattern exactly.
-- ============================================================

CREATE POLICY "Admins can update any job"
  ON public.jobs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update any gig"
  ON public.gigs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update any post"
  ON public.posts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete any post"
  ON public.posts FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete any discussion"
  ON public.discussions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete any project"
  ON public.builder_projects FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

NOTIFY pgrst, 'reload schema';
