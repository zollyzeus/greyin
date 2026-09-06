import { SupabaseClient } from '@supabase/supabase-js'

const OWN_PILLAR = 'longlist'

/**
 * UI/UX elevation plan, Phase 6 -- lightweight, self-hosted analytics
 * (116_analytics_events.sql). Fire-and-forget, same "lazy, best-effort"
 * posture as parseSearchQuery's own LLM call: never awaited by the
 * caller, never throws, a failed insert (RLS denial, network blip) is
 * silently dropped rather than surfacing to the user or blocking the
 * interaction it's measuring.
 */
export function logEvent(supabase: SupabaseClient, userId: string, eventType: string, metadata: Record<string, unknown> = {}): void {
  supabase
    .from('analytics_events')
    .insert({ user_id: userId, pillar: OWN_PILLAR, event_type: eventType, metadata })
    .then(
      () => {},
      () => {}
    )
}
