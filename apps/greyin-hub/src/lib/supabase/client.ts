import { createBrowserClient } from '@supabase/ssr'

// SSO across the *.greyin.net apps is achieved server-side (see
// lib/supabase/server.ts) -- every login in this app goes through a
// server-rendered <form method="POST"> route, so the Set-Cookie header
// (with domain=.greyin.net) is issued by the server, not the browser.
// Same constraint as every other app in this monorepo: passing any options
// object to createBrowserClient crashes the installed @supabase/ssr
// (0.1.0) on session load, so this stays a bare 2-argument call.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
