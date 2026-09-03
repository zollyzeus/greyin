import { createBrowserClient } from '@supabase/ssr'

// SSO across the four *.greyin.net apps is achieved server-side (see
// lib/supabase/server.ts) — every login/signup in this app goes through a
// server-rendered <form method="POST"> route, so the Set-Cookie header
// (with domain=.greyin.net) is issued by the server, not the browser.
// A `cookieOptions: { domain }` param here would do the equivalent for
// client-side-issued cookies, but the installed @supabase/ssr (0.1.0, a
// very old release) crashes on session load when that option is passed
// (TypeError reading 'get' inside its cookie storage adapter) — so this
// stays plain. Upgrading @supabase/ssr to a version with a fixed adapter
// would let this carry the option too, but that's a separate, riskier change.
//
// Turns out this isn't specific to cookieOptions — createBrowserClient's
// destructuring (`const { cookies, ... } = options`) has no default for
// `cookies`, so passing *any* options object here (verified with a plain
// `{ auth: { storageKey } }`, no cookieOptions at all) reintroduces the
// exact same "Cannot read properties of undefined (reading 'get')" crash.
// This has to stay a bare 2-argument call — see lib/supabase/server.ts for
// how the server side works around still needing a matching cookie name
// without touching this file.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
