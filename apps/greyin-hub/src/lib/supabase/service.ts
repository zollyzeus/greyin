import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * RLS-bypassing client for privileged server-side operations a normal
 * user's session must never be able to perform directly. Same pattern as
 * every other app's own lib/supabase/service.ts (e.g. apps/stackworks).
 * Used here only for read-only aggregate counts (the homepage's per-pillar
 * activity stats) whose underlying tables have no anonymous-readable RLS
 * branch at all -- never for anything that exposes individual rows.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
