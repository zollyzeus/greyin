-- ============================================================
-- Optional anonymous posting (Salt & Pepper) — from the "not recommended"
-- list, built anyway per explicit request
-- ============================================================
--
-- A per-post toggle, not a platform-wide identity model — the real
-- author_id is always stored (admin moderation and the reputation system
-- in 025 both still attribute correctly), only the *displayed* name is
-- hidden from other members when set. This preserves the accountability
-- that's the actual point of Salt & Pepper's real-identity gate (see
-- COMPETITIVE_BENCHMARK.md) while giving people an option for genuinely
-- sensitive topics, rather than making anonymity the default.
-- ============================================================

ALTER TABLE public.discussions ADD COLUMN is_anonymous BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.discussion_replies ADD COLUMN is_anonymous BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
