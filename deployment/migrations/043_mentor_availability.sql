-- ============================================================
-- Mentor availability, decoupled from having personally pivoted
-- ============================================================
--
-- 042 only let completed pivoters show up on Salt & Pepper's /mentors --
-- but a lifelong domain expert who never personally changed careers is
-- often exactly the right person to mentor someone entering their field,
-- and had no way to opt in. This separates "I am/was pivoting" (is_pivoter,
-- drives the Greyin B2B career-changer job gate + Prolab badge) from
-- "I'm available to mentor people into a domain" (is_mentor) -- a
-- Verified Expert can set either, both, or neither.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_mentor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mentor_domain TEXT,
  ADD COLUMN IF NOT EXISTS mentor_note TEXT;

-- No RLS changes: same reasoning as 042 -- profiles' existing unconditional
-- SELECT policy and "users can update their own profile" policy already
-- cover new columns on an existing row.

NOTIFY pgrst, 'reload schema';
