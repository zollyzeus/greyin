-- ============================================================
-- UI/UX elevation plan, Phase 6 -- lightweight, self-hosted analytics.
-- User chose this over a third-party service (PostHog/GA/etc, 2026-09-05):
-- no new external dependency, no new cost, data stays in the platform's
-- own Supabase instance. Trades away out-of-the-box dashboards/funnels
-- for a plain table any admin can query directly.
--
-- Named events this exists to answer (plan's own Phase 6 line item):
-- rail nav usage, pillar-switch rate, notification-bell open rate, guided
-- tour completion, ⌘K command-palette usage. Free-form `event_type` +
-- `metadata` rather than one column per event shape, since this list is
-- explicitly expected to grow ("lightweight analytics" is a starting
-- point, not a fixed schema) -- same "unfiltered view, curated by
-- convention not by schema" posture platform_search_index/
-- platform_people_index already use for a different reason.
-- ============================================================

CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pillar TEXT NOT NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_type_created ON public.analytics_events(event_type, created_at);
CREATE INDEX idx_analytics_events_pillar_created ON public.analytics_events(pillar, created_at);
CREATE INDEX idx_analytics_events_user ON public.analytics_events(user_id);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Write-only from the member's own side -- every instrumentation site is
-- a fire-and-forget client-side insert (never blocks the UI, never
-- surfaces an error), same "lazy, best-effort" posture as
-- parseSearchQuery's own LLM call.
CREATE POLICY "Members can log their own analytics events"
  ON public.analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Reading is admin-only -- this is aggregate product-usage data, not
-- something a regular member has any reason to see about themselves or
-- (worse) infer about others by probing the table.
CREATE POLICY "Admins can view all analytics events"
  ON public.analytics_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

NOTIFY pgrst, 'reload schema';
