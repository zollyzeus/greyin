import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * RLS-bypassing client for privileged server-side operations a normal
 * user's session must never be able to perform directly -- e.g. writing
 * an AI-generated verification score onto a row the submitter doesn't
 * own. Same trust model as freeagent's razorpay webhook route: RLS is
 * not the gate here, the calling route's own auth/ownership check is --
 * only call this after that check has already run.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
