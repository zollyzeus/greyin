import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// See lib/supabase/client.ts for why this is scoped to the whole apex
// domain — real SSO across all four *.greyin.net apps.
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || '.greyin.net'

// See deepedge's lib/supabase/server.ts for the full explanation — this
// has to derive the same cookie name @supabase/ssr's createBrowserClient
// computes from NEXT_PUBLIC_SUPABASE_URL, since the browser side can't be
// told to use a custom one without crashing.
function deriveAuthStorageKey(): string {
  const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
  return `sb-${hostname.split('.')[0]}-auth-token`
}

export async function createClient() {
  const cookieStore = await cookies()

  // See deepedge's lib/supabase/server.ts for why this isn't just
  // NEXT_PUBLIC_SUPABASE_URL.
  return createServerClient(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: deriveAuthStorageKey() },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...options, domain: COOKIE_DOMAIN, secure: true, sameSite: 'lax' })
            )
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
