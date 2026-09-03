import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * RLS-bypassing client for privileged server-side operations a normal
 * user's session must never be able to perform directly -- e.g. writing
 * an AI-generated mentoring-quality score onto a reply the viewer of the
 * thread (not the reply's own author) triggered the scoring for. Same
 * trust model as freeagent's razorpay webhook route: RLS is not the
 * gate here, the calling route's own logic is -- only call this from
 * server-side code that isn't exposing arbitrary writes to the client.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
