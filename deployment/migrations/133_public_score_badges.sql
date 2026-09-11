-- ============================================================
-- Shareable Verified Score badge (Phase D2, "11 new AI enhancements"
-- plan) -- opt-in only, matching this session's established
-- privacy-conscious default (profile_demographics, bias-audit self-ID):
-- a user must explicitly turn this on before anything about them is
-- reachable without login. This is the platform's first genuinely
-- public, no-login page showing real profile-derived data (jobs/[id] is
-- the closest existing precedent for the page SHAPE, but a job posting
-- isn't one person's own data).
-- ============================================================

CREATE TABLE public.public_score_badges (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.public_score_badges ENABLE ROW LEVEL SECURITY;

-- Deliberately self-only, even for SELECT -- the row itself (which
-- contains the real slug) is never publicly listable; public access to
-- the badge's DATA goes only through get_public_score_badge() below,
-- gated on enabled=true, never a raw table read.
CREATE POLICY "Users manage their own badge row"
  ON public.public_score_badges FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER public_score_badges_updated_at
  BEFORE UPDATE ON public.public_score_badges
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Anon-callable by design (this page has no login) -- returns ONLY the
-- same score breakdown already shown on the user's own profile page
-- today (greyin_scores' pillar scores/evidence COUNTS + platform
-- composite + years_experience), never raw evidence rows (no review
-- text, no project titles, no reputation event detail). Returns nothing
-- at all for a wrong slug or a disabled badge -- same shape either way,
-- so a stranger probing slugs can't distinguish "never existed" from
-- "exists but turned off".
CREATE OR REPLACE FUNCTION get_public_score_badge(p_slug TEXT)
RETURNS TABLE (
  full_name TEXT,
  greyin_score DOUBLE PRECISION,
  is_verified_expert BOOLEAN,
  stackworks_score NUMERIC,
  stackworks_evidence BIGINT,
  flexpro_score NUMERIC,
  flexpro_evidence INTEGER,
  saltnpepper_score NUMERIC,
  saltnpepper_evidence BIGINT,
  greymatters_score NUMERIC,
  greymatters_evidence BIGINT,
  platform_composite DOUBLE PRECISION,
  years_experience INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.full_name, gs.greyin_score, gs.is_verified_expert,
    gs.stackworks_score, gs.stackworks_evidence,
    gs.flexpro_score, gs.flexpro_evidence,
    gs.saltnpepper_score, gs.saltnpepper_evidence,
    gs.greymatters_score, gs.greymatters_evidence,
    gs.platform_composite, gs.years_experience
  FROM public.public_score_badges b
  JOIN public.profiles p ON p.id = b.user_id
  JOIN public.greyin_scores gs ON gs.user_id = b.user_id
  WHERE b.slug = p_slug AND b.enabled = true;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_score_badge(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
