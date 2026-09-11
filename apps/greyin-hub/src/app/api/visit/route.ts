import { NextResponse } from 'next/server'

// Anonymous page-visit tracking (Emergent-parity gap #2 part 2, 145) --
// a plain stateless fetch to the RPC endpoint using the anon key, not
// the cookie-bound @supabase/ssr server client -- this is called on
// every homepage load, including a visitor's very first request with no
// session cookie at all, matching the exact risk
// apps/greymatters-blog/src/app/api/newsletter/subscribe/route.ts's own
// comment describes (a fresh client's first Supabase call risking a
// session-recovery crash) even more directly than that route does.
export async function POST(request: Request) {
  const { path } = await request.json().catch(() => ({ path: '/' }))

  const rawClientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  const isPrivateOrUnknownIp =
    !rawClientIp || /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1$|f[cd])/i.test(rawClientIp)

  const baseUrl = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const rpcHeaders = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' }

  if (!isPrivateOrUnknownIp) {
    const allowedRes = await fetch(`${baseUrl}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ p_action: 'page_visit', p_key: rawClientIp, p_max_failures: 30, p_window_minutes: 60 }),
    })
    const allowed = await allowedRes.json().catch(() => false)
    if (!allowed) {
      return NextResponse.json({ ok: false }, { status: 429 })
    }
    await fetch(`${baseUrl}/rest/v1/rpc/record_rate_limit_attempt`, {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ p_action: 'page_visit', p_key: rawClientIp, p_success: false }),
    })
  }

  await fetch(`${baseUrl}/rest/v1/rpc/record_page_visit`, {
    method: 'POST',
    headers: rpcHeaders,
    body: JSON.stringify({ p_path: typeof path === 'string' ? path : '/' }),
  })

  return NextResponse.json({ ok: true })
}
