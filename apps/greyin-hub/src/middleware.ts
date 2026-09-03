import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// See lib/supabase/client.ts for why this is scoped to the whole apex
// domain — real SSO across all *.greyin.net apps.
const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || '.greyin.net'

// SEC-016 (2026-08-24 security audit): secure + sameSite='lax' added below
// -- safe here because this is createServerClient (already proven to accept
// a cookieOptions object without issue), not the createBrowserClient in
// lib/supabase/client.ts that crashes on any options object at all (see
// that file's comment). httpOnly is deliberately NOT added: every app's
// SiteHeader.tsx calls createClient().auth.getUser() client-side to decide
// whether to show "Sign In" -- an httpOnly cookie is invisible to that
// browser-side SDK call, so every header across the platform would show
// "Sign In" even while genuinely logged in. Closing that class of exposure
// for real would need moving every such client-side auth check to a
// server-rendered prop instead, a real refactor across all 6 apps, not a
// cookie-flag change -- tracked as a known, deliberate gap rather than
// forced through given this exact code path has already broken production
// auth once this session.

// See lib/supabase/server.ts for the full explanation — this has to derive
// the same cookie name @supabase/ssr's createBrowserClient computes from
// NEXT_PUBLIC_SUPABASE_URL, since the browser side can't be told to use a
// custom one without crashing.
function deriveAuthStorageKey(): string {
  const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
  return `sb-${hostname.split('.')[0]}-auth-token`
}

// Every app's lib/supabase/server.ts cookie set()/remove() has a comment
// saying failures there "can be ignored if you have middleware refreshing
// user sessions" -- this file is that middleware. Without it, an expiring
// Supabase access token never gets its refreshed Set-Cookie persisted back
// to the browser, so a session that's been open a while (or has navigated
// across the *.greyin.net apps, each with their own independent cookie
// lifecycle) silently stops authenticating -- indistinguishable from "logout
// isn't working" or "I have to log in again" from a real user's side. Only
// deepedge had this file; found and fixed as a real bug report (2026-08-24).
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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
