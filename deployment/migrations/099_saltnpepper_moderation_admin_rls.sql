-- ============================================================
-- Admin RLS for the moderation review queue (098) -- the admin UI's
-- "clear flag" / "delete reply" actions run through the regular
-- user-scoped client, not service-role, so they need real policies.
-- discussion_replies had ZERO admin policies of any kind before this
-- (only member-insert + authenticated-select) -- the only existing
-- moderation capability was deleting an entire discussion (cascades to
-- its replies), never touching a reply on its own.
-- ============================================================

CREATE POLICY "Admins can update any discussion"
  ON public.discussions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update any reply"
  ON public.discussion_replies FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete any reply"
  ON public.discussion_replies FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

NOTIFY pgrst, 'reload schema';
