-- ============================================================
-- Prolab verification engine (+ platform-wide LLM wrapper config)
-- ============================================================
--
-- Populates verified_outcomes (030), which had zero writers until now.
-- An accepted applicant submits evidence against an ask; an AI provider
-- (if one is configured) scores it first, then the ask's owner can add a
-- human score that coexists with the AI's original score permanently
-- (separate ai_*/human_* column families -- neither ever overwrites the
-- other). If nobody reviews within 14 days, it auto-resolves from the AI
-- score alone via finalize_expired_verified_outcomes(), called lazily on
-- page load -- this deployment has no pg_cron (see 023/greymatters
-- digest route for the same lazy-resolution convention already in use).
--
-- llm_providers/llm_feature_flags hold live-configurable AI provider
-- credentials (Anthropic/OpenAI/Ollama) so the verification pipeline
-- never has a single hardcoded vendor -- an admin panel manages these,
-- not .env, so a provider can be added/rotated/disabled without a
-- redeploy. Schema is platform-wide (shared Supabase tenant across all 5
-- apps) even though only prolab consumes it today.
--
-- Run this after 030_prolab_launch.sql
-- ============================================================

-- ------------------------------------------------------------
-- llm_providers / llm_feature_flags: platform-wide AI provider config
-- ------------------------------------------------------------
CREATE TABLE public.llm_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT CHECK (provider IN ('anthropic', 'openai', 'ollama')) NOT NULL,
  label TEXT NOT NULL,
  api_key TEXT,
  base_url TEXT,
  model TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.llm_providers IS 'Admin-managed AI provider credentials (Anthropic/OpenAI/Ollama). Lower priority number tried first; client falls through to the next enabled provider on failure.';
COMMENT ON COLUMN public.llm_providers.api_key IS 'NULL for provider=ollama (local/self-hosted, no key -- base_url + model only).';

ALTER TABLE public.llm_providers ENABLE ROW LEVEL SECURITY;

-- Admin-only in every direction -- these rows hold real secrets. The
-- verification pipeline itself reads this table via a service-role
-- client (bypasses RLS entirely, same trust model as freeagent's
-- razorpay webhook route), never via a normal user's session.
CREATE POLICY "Admins manage llm providers"
  ON public.llm_providers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE TABLE public.llm_feature_flags (
  feature_key TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  provider_id UUID REFERENCES public.llm_providers ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.llm_feature_flags IS 'Per-feature AI on/off switch. provider_id NULL = use the highest-priority enabled provider rather than a pinned one.';

ALTER TABLE public.llm_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage llm feature flags"
  ON public.llm_feature_flags FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO public.llm_feature_flags (feature_key, enabled) VALUES ('prolab_verification', true);

-- ------------------------------------------------------------
-- project_asks: optional job-poster-supplied verification criteria
-- ------------------------------------------------------------
ALTER TABLE public.project_asks
  ADD COLUMN IF NOT EXISTS verification_criteria TEXT;

COMMENT ON COLUMN public.project_asks.verification_criteria IS 'Optional test cases / expected output the ask owner provides up front; if set, the AI verifies submitted work against this instead of inferring criteria from the ask description alone.';

-- ------------------------------------------------------------
-- verified_outcomes: AI score + human score, both permanent
-- ------------------------------------------------------------
ALTER TABLE public.verified_outcomes
  ADD COLUMN IF NOT EXISTS ai_score NUMERIC,
  ADD COLUMN IF NOT EXISTS ai_notes TEXT,
  ADD COLUMN IF NOT EXISTS ai_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_provider TEXT,
  ADD COLUMN IF NOT EXISTS human_score NUMERIC,
  ADD COLUMN IF NOT EXISTS human_notes TEXT,
  ADD COLUMN IF NOT EXISTS human_reviewed_by UUID REFERENCES public.profiles,
  ADD COLUMN IF NOT EXISTS human_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_deadline TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');

COMMENT ON COLUMN public.verified_outcomes.score IS 'Final resolved score (0-100), set once by whichever finalizes first: a human review, or the 14-day auto-expiry. Never touches ai_score.';
COMMENT ON COLUMN public.verified_outcomes.ai_score IS 'AI-generated score (0-100), set once at submission time (if a provider is configured) and never overwritten -- stays visible permanently even after a human score is added.';

-- Additional PERMISSIVE policies for the same command combine with OR in
-- Postgres, so these extend (not replace) 030's admin-only INSERT/UPDATE
-- policies -- no need to touch those.
CREATE POLICY "Subjects can submit their own outcome for verification"
  ON public.verified_outcomes FOR INSERT
  WITH CHECK (auth.uid() = subject_user_id);

CREATE POLICY "Ask and project owners can add their human review"
  ON public.verified_outcomes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_applications pa
      JOIN public.project_asks pk ON pk.id = pa.ask_id
      WHERE pa.id = verified_outcomes.application_id AND pk.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.builder_projects bp
      WHERE bp.id = verified_outcomes.project_id AND bp.user_id = auth.uid()
    )
  );

CREATE INDEX idx_verified_outcomes_application_id ON public.verified_outcomes(application_id);
CREATE INDEX idx_verified_outcomes_review_deadline ON public.verified_outcomes(review_deadline) WHERE status = 'pending';

-- ------------------------------------------------------------
-- finalize_expired_verified_outcomes(): lazy 14-day window resolution
-- ------------------------------------------------------------
-- No pg_cron in this deployment (same constraint noted in 023 and
-- greymatters' digest route) -- called opportunistically at the top of
-- any page that lists outcomes, instead of running on a schedule.
-- SECURITY DEFINER since it must resolve rows regardless of which user's
-- session triggered the catch-up; scope is self-limiting (only rows
-- already past their own deadline with no human review).
CREATE OR REPLACE FUNCTION public.finalize_expired_verified_outcomes()
RETURNS void AS $$
BEGIN
  UPDATE public.verified_outcomes
  SET
    score = ai_score,
    status = CASE WHEN ai_score >= 70 THEN 'verified' ELSE 'rejected' END,
    verification_method = 'ai_auto_expired',
    verified_at = NOW(),
    updated_at = NOW()
  WHERE status = 'pending'
    AND review_deadline < NOW()
    AND human_reviewed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.finalize_expired_verified_outcomes() TO authenticated;

NOTIFY pgrst, 'reload schema';
