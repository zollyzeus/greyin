-- ============================================================
-- Pivoter track: cross-domain career changers
-- ============================================================
--
-- Support for senior professionals switching domains (out of passion or
-- market necessity), not just staying in their existing lane -- distinct
-- from the normal Verified Expert pool on purpose: a 15-year finance
-- veteran with zero coding background shouldn't surface in an employer's
-- search for senior software engineers just because years_experience >= 12.
-- Pivoters get a separate, explicit path instead: employers opt in per
-- job ("open to career changers"), and only pivoter-tagged candidates can
-- apply to those specific jobs without also being a domain-relevant
-- Verified Expert. The tag itself is only settable by users who already
-- ARE Verified Experts (enforced in application code, not here) -- keeps
-- pivoters recognizably senior, just in the wrong domain for a given
-- search, rather than a backdoor around the gate.
--
-- Cross-pillar by design, same as years_experience/prolab_role: set once
-- on the shared profiles row (via Greyin B2B's /profile), read by Prolab
-- (People directory badge) and Salt & Pepper (mentor matching) too.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_pivoter BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pivot_from_domain TEXT,
  ADD COLUMN IF NOT EXISTS pivot_to_domain TEXT,
  ADD COLUMN IF NOT EXISTS pivot_note TEXT,
  ADD COLUMN IF NOT EXISTS pivot_status TEXT CHECK (pivot_status IN ('seeking', 'completed'));

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS open_to_career_changers BOOLEAN NOT NULL DEFAULT false;

-- No RLS changes: profiles already has an unconditional "USING (true)"
-- SELECT policy and an existing "users can update their own profile"
-- UPDATE policy (already exercised by /profile edits), and jobs already
-- has employer-owns-the-row INSERT/UPDATE policies -- new columns on an
-- existing row are covered by both automatically.

NOTIFY pgrst, 'reload schema';
