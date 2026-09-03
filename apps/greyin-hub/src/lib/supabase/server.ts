import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Real SSO across all *.greyin.net apps -- see lib/supabase/client.ts.
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || '.greyin.net'

// Has to derive the same cookie name @supabase/ssr's createBrowserClient
// computes from NEXT_PUBLIC_SUPABASE_URL, since the browser side can't be
// told to use a custom one without crashing (see client.ts).
function deriveAuthStorageKey(): string {
  const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
  return `sb-${hostname.split('.')[0]}-auth-token`
}

export async function createClient() {
  const cookieStore = await cookies()

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
