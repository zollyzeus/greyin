import 'dotenv/config'
import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Anonymous page-visit tracking (Emergent-parity gap #2 part 2, 145) --
 * VisitTracker fires a real client-side POST on homepage mount;
 * record_page_visit()/get_page_visit_trend() are the two SECURITY
 * DEFINER functions on either end.
 */
test('loading the homepage anonymously records a real visit, visible in the admin trend', async ({ page, cleanup }) => {
  await fetch(`${SUPABASE_URL}/rest/v1/page_visits`, { method: 'DELETE', headers: restHeaders() }).catch(() => {})

  await page.goto('https://greyin.net/')
  // The tracker fires fire-and-forget on mount -- give it a moment to land.
  await page.waitForTimeout(1500)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/page_visits?select=*`, { headers: restHeaders() })
  const rows = await res.json()
  expect(rows.length).toBeGreaterThan(0)
  expect(rows[0].path).toBe('/')

  const admin = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(page, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  await page.goto('/admin/overview')
  await expect(page.getByText('Visits (last 30 days)')).toBeVisible()
  await expect(page.locator('svg[aria-label="Anonymous page visits, last 30 days"]')).toBeVisible()

  await fetch(`${SUPABASE_URL}/rest/v1/page_visits`, { method: 'DELETE', headers: restHeaders() }).catch(() => {})
})

// Can't exercise this via a real HTTP request to /api/visit: Traefik
// correctly refuses to trust a client-supplied X-Forwarded-For and
// substitutes the actual observed peer address, which -- since these
// tests run on the same docker host that serves the app -- is always
// the bridge gateway (172.18.0.1), a private IP the route's own
// isPrivateOrUnknownIp check deliberately skips rate-limiting for (the
// same reason demo_login's and signup's own e2e specs never exercise
// their real 429 paths either). What's actually testable, and what the
// route's rate-limiting genuinely depends on, is the check_rate_limit /
// record_rate_limit_attempt RPC pair itself (075) for the 'page_visit'
// action (widened onto the CHECK constraint in 145) -- verified here
// directly against a synthetic key.
test('page_visit rate-limit RPCs correctly block a key after repeated attempts', async () => {
  const fakeKey = `203.0.113.${Math.floor(Math.random() * 250) + 1}` // TEST-NET-3, never a real client
  await fetch(`${SUPABASE_URL}/rest/v1/rate_limit_attempts?action=eq.page_visit&key=eq.${fakeKey}`, {
    method: 'DELETE',
    headers: restHeaders(),
  }).catch(() => {})

  const rpcHeaders = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' }

  for (let i = 0; i < 30; i++) {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_rate_limit_attempt`, {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ p_action: 'page_visit', p_key: fakeKey, p_success: false }),
    })
  }

  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
    method: 'POST',
    headers: rpcHeaders,
    body: JSON.stringify({ p_action: 'page_visit', p_key: fakeKey, p_max_failures: 30, p_window_minutes: 60 }),
  })
  const allowed = await checkRes.json()
  expect(allowed).toBe(false)

  await fetch(`${SUPABASE_URL}/rest/v1/rate_limit_attempts?action=eq.page_visit&key=eq.${fakeKey}`, {
    method: 'DELETE',
    headers: restHeaders(),
  }).catch(() => {})
})
