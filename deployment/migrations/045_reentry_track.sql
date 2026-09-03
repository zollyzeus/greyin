-- ============================================================
-- Career re-entry track: professionals returning after a gap
-- ============================================================
--
-- Same founding thesis as the Pivoter track (042) -- systemic bias against
-- experienced professionals, not just age -- but a different bias: a gap
-- in the timeline (caregiving, health, layoff, sabbatical) reading as a red
-- flag even when the underlying experience is still current and relevant.
--
-- Deliberately NOT structured like Pivoter. Pivoter excludes tagged
-- candidates from general employer search because of a genuine domain
-- mismatch (a finance veteran pivoting into engineering shouldn't surface
-- in a "senior engineers" search) and gives them a bypass path via
-- jobs.open_to_career_changers. Re-entry candidates have no such mismatch --
-- they're returning to the SAME field, so they already qualify as Verified
-- Experts on their existing years/score. This is purely additive: a
-- badge/context signal shown wherever a candidate's profile already
-- surfaces, not a separate application path. jobs.open_to_reentry below is
-- a soft, informational signal an employer opts into ("we don't screen out
-- candidates with gaps"), not an eligibility gate -- no code path checks it
-- to grant or deny an application, unlike open_to_career_changers.
--
-- No reentry_status field (unlike Pivoter's seeking/completed) -- there's
-- no two-state journey here, just an ongoing self-identification.
--
-- Cross-pillar by design, same as years_experience/is_pivoter: set once on
-- the shared profiles row (via Greyin B2B's /profile), read by Prolab
-- (People directory badge) and Salt & Pepper (mentors page note) too.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_reentry BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reentry_reason TEXT CHECK (reentry_reason IN ('caregiving', 'health', 'layoff', 'sabbatical', 'relocation', 'other')),
  ADD COLUMN IF NOT EXISTS reentry_note TEXT;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS open_to_reentry BOOLEAN NOT NULL DEFAULT false;

-- No RLS changes: same reasoning as 042/043 -- profiles' existing
-- unconditional SELECT policy and "users can update their own profile"
-- policy already cover new columns on an existing row, and jobs already
-- has employer-owns-the-row INSERT/UPDATE policies.

NOTIFY pgrst, 'reload schema';
