-- ============================================================
-- newsletter_subscribers: admin-only SELECT policy
-- ============================================================
--
-- 008_newsletter.sql only ever granted an INSERT policy ("Anyone can
-- subscribe to the newsletter") -- there was never a SELECT policy at
-- all. /api/admin/digest/send (added later, reads via the normal
-- cookie-bound anon-key client, not the service role) has therefore
-- always redirected with "No active subscribers." regardless of how
-- many real rows exist, since RLS silently returns zero rows to every
-- caller including admins. Discovered while writing e2e coverage for
-- that admin action (Phase 5 of the revamp plan).
--
-- Scoped to admins only, matching platform_gate_settings' own
-- "Admins can update gate settings" pattern -- subscriber emails are the
-- one piece of PII this table holds, so this intentionally does not open
-- read access to everyone the way the INSERT policy is open to everyone.
-- ============================================================

CREATE POLICY "Admins can view newsletter subscribers"
  ON public.newsletter_subscribers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

NOTIFY pgrst, 'reload schema';
