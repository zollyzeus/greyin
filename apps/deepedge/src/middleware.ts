import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// See lib/supabase/client.ts for why this is scoped to the whole apex
// domain — real SSO across all four *.greyin.net apps.
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || '.greyin.net'

// SEC-016 (2026-08-24 security audit): secure + sameSite='lax' added below
// -- safe here because this is createServerClient, not the createBrowserClient
// in lib/supabase/client.ts (see that file's comment for the crash history
// this rewrite fixes). httpOnly is deliberately NOT added: every app's
// SiteHeader.tsx calls createClient().auth.getUser() client-side to decide
// whether to show "Sign In" -- an httpOnly cookie is invisible to that
// browser-side SDK call, so every header across the platform would show
// "Sign In" even while genuinely logged in. Closing that class of exposure
// for real would need moving every such client-side auth check to a
// server-rendered prop instead, a real refactor across all 6 apps, not a
// cookie-flag change -- tracked as a known, deliberate gap.

// See lib/supabase/server.ts for the full explanation — this has to derive
// the same cookie name @supabase/ssr's createBrowserClient computes from
// NEXT_PUBLIC_SUPABASE_URL, since the browser side can't be told to use a
// custom one without crashing.
function deriveAuthStorageKey(): string {
  const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
  return `sb-${hostname.split('.')[0]}-auth-token`
}

// SEC-036 (2026-08-26 security audit): @supabase/ssr 0.1.0 -> 0.12.5.
// The cookie adapter API changed from three methods (get/set/remove) to
// two (getAll/setAll, each handling arrays of {name, value, options}) --
// this is that rewrite, preserving the same 3 things the old version did:
// cookieOptions.name (cross-app SSO cookie naming), SEC-016's secure/
// sameSite/domain overrides on every write, and the dual write to both
// request.cookies (so a Server Component later in THIS request sees the
// refreshed session) and response.cookies (so the browser gets the new
// Set-Cookie). A "remove" is just a setAll entry with an empty value now,
// no separate method needed. A first attempt at this rewrite staged one
// app at a time and was reverted the same day: 0.1.0 and 0.12.5 write
// session cookies in incompatible formats, so a mixed-version state
// breaks cross-app SSO instantly (every app except the one just updated
// stops recognizing a session from it). This deploy is an all-6-apps-at-
// once atomic cutover instead, done with no live end users on the
// platform yet, so there's no live-session-compatibility window to
// protect during the transition.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // See lib/supabase/server.ts for why this isn't just NEXT_PUBLIC_SUPABASE_URL.
  const supabase = createServerClient(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: deriveAuthStorageKey() },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
              domain: COOKIE_DOMAIN,
              secure: true,
              sameSite: 'lax',
            })
          })
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
