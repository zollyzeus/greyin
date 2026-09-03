import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * RLS-bypassing client for privileged server-side operations a normal
 * user's session must never be able to perform directly -- e.g. writing
 * an AI-generated delivery-quality score onto an order neither party
 * directly owns the write path for. Same trust model as this app's
 * razorpay webhook route (which has used this pattern inline until now):
 * RLS is not the gate here, the calling route's own auth/ownership check
 * is -- only call this after that check has already run.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
