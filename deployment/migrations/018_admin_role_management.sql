-- ============================================================
-- Admin UI for promoting/demoting user roles
-- ============================================================
--
-- profiles UPDATE was owner-only ("Users can update own profile"); admins
-- had no way to change another user's role except direct SQL. profiles
-- SELECT is already unconditional ("Public profiles are viewable by
-- everyone" USING (true)), so unlike jobs/gigs/posts (015/016) there's no
-- RETURNING-visibility gotcha here — a plain admin UPDATE policy is enough.
-- ============================================================

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles admin_check WHERE admin_check.id = auth.uid() AND admin_check.role = 'admin'));

NOTIFY pgrst, 'reload schema';
