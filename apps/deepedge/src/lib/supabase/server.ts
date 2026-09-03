import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// See lib/supabase/client.ts for why this is scoped to the whole apex
// domain — real SSO across all four *.greyin.net apps.
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || '.greyin.net'

// @supabase/ssr's createBrowserClient can't safely take a custom
// storageKey (see client.ts), so it always ends up with whatever
// supabase-js derives on its own from NEXT_PUBLIC_SUPABASE_URL:
// `sb-${new URL(url).hostname.split('.')[0]}-auth-token` (confirmed by
// reading node_modules/@supabase/supabase-js's own source — this is
// undocumented but stable across versions). SUPABASE_INTERNAL_URL below
// swaps which host this server actually *connects* to without the client
// ever knowing, so deriving the cookie name from THAT instead of
// NEXT_PUBLIC_SUPABASE_URL would silently point client and server at two
// different cookies (a real bug this surfaced: the isolated e2e stack's
// "kong" internal hostname vs. the browser's "localhost"). Always derive
// from NEXT_PUBLIC_SUPABASE_URL, matching the browser, regardless of which
// URL is actually used for the connection below.
function deriveAuthStorageKey(): string {
  const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
  return `sb-${hostname.split('.')[0]}-auth-token`
}

export async function createClient() {
  const cookieStore = await cookies()

  // NEXT_PUBLIC_SUPABASE_URL is baked into the client bundle at build time
  // and must be a URL the *browser* can reach. This code runs server-side
  // inside the container instead, where that same URL isn't necessarily
  // reachable (e.g. the isolated e2e stack's frontend containers need the
  // Compose-internal Kong hostname, not the host-published one the browser
  // uses) — SUPABASE_INTERNAL_URL is a runtime-only escape hatch for that;
  // unset in production, so behavior there is unchanged.
  // SEC-036 (2026-08-26 security audit): @supabase/ssr 0.1.0 -> 0.12.5,
  // get/set/remove -> getAll/setAll -- see middleware.ts for the full
  // rewrite rationale. secure/sameSite added here to match SEC-016's
  // middleware.ts hardening (the old version of this file predated that
  // fix and never carried it -- middleware refreshing the session was
  // covering for it, but a direct Server-Component-issued cookie should
  // get the same flags too).
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
