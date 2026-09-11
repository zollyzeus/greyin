import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, signUpFlexPro, login } from '../../utils/auth'
import { getUserIdByEmail, createTestGig } from '../../utils/admin'

/**
 * Permanent regression guard for the two most severe findings in the
 * 2026-08-24 pre-launch security audit (docs/requirements-traceability/greyin-requirements-
 * traceability.xlsx, "Security Findings" sheet, SEC-002 and SEC-003).
 * Both were real, exploitable gaps found and fixed the same day
 * (migrations 067/068/070, apps/flexpro/src/app/api/
 * orders/create/route.ts) -- this exists so neither can silently
 * regress. Deliberately bypasses the app's own UI/routes for the first
 * test (same "even bypassing the UI" pattern as skill-endorsements.spec.ts)
 * since the real exploit was a direct PostgREST call, not anything the
 * app's own forms would ever send.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const b2bBase = isLocal ? `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}` : 'https://deepedge.greyin.net'
const flexproBase = isLocal ? `http://localhost:${process.env.E2E_FREEAGENT_PORT || 3102}` : 'https://flexpro.greyin.net'
const SUPABASE_URL = process.env.SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

test('a user cannot escalate their own role to admin via a direct API call, even bypassing the UI entirely', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, user, '/dashboard', b2bBase)
  const userId = await getUserIdByEmail(user.email)

  // A real attacker doesn't need to steal a browser session -- they only
  // need SOME valid access token for their own account, which they
  // trivially have via their own email/password. This app's browser
  // client stores its session in cookies via @supabase/ssr, not
  // localStorage, so a direct GoTrue password-grant token exchange is
  // both simpler and a more realistic simulation of the actual exploit
  // than trying to extract/decode the cookie-stored session.
  const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  })
  const { access_token: accessToken } = await tokenRes.json()
  expect(accessToken).toBeTruthy()

  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ role: 'admin' }),
  })

  // PostgREST surfaces an RLS/trigger block as 4xx (typically 400/403),
  // never a 2xx -- the real assertion, though, is the DB state itself.
  expect(patchRes.status).toBeGreaterThanOrEqual(400)

  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  })
  const rows = await checkRes.json()
  expect(rows[0]?.role).not.toBe('admin')
})

test('a buyer cannot set their own price on order creation -- the amount is always recomputed from the gig\'s real price', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup, 15, flexproBase)
  const sellerId = await getUserIdByEmail(seller.email)
  const gig = await createTestGig(sellerId, { price_min: 2000 })
  await sellerCtx.close()

  const buyerCtx = await browser.newContext()
  const buyerPage = await buyerCtx.newPage()
  const buyer = await signUpFlexPro(buyerPage, 'client', cleanup, 15, flexproBase)
  await login(buyerPage, buyer, `${flexproBase}/dashboard`, flexproBase)

  const result = await buyerPage.evaluate(
    async ({ gigId }) => {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // A real buyer's browser would never send this, but the whole
        // point is that a crafted request shouldn't be able to either --
        // amount=1 for a gig whose basic package should really cost 2000.
        body: JSON.stringify({ gigId, packageType: 'basic', amount: 1 }),
      })
      return { status: res.status, body: await res.json() }
    },
    { gigId: gig.id }
  )

  expect(result.status).toBe(200)
  // The Razorpay order amount is in paise -- 2000 (price_min) * 1 (basic
  // multiplier) * 100 = 200000, never the tampered 1.
  expect(result.body.amount).toBe(200000)
  await buyerCtx.close()
})

/**
 * SEC-021 (2026-08-25 security audit): two real instances of the same
 * open-redirect bug, both found and fixed the same day. `next=` was only
 * checked with startsWith('/') && !startsWith('//'), which misses a
 * backslash -- browsers normalize \ to / when parsing a URL, so
 * `/\evil.com` resolves to `https://evil.com/`. Fixed in
 * auth/login/route.ts (POST handler, case 1 below) and independently in
 * login/page.tsx's own `redirect(next || '/dashboard')` for an
 * already-logged-in visitor (case 2 below), which had NO validation at
 * all before this fix -- worse than the route.ts case, since it fires on
 * a bare page load, no form submission needed. Uses page.request with
 * maxRedirects: 0 to inspect the server's raw Location header rather
 * than actually navigating to a real third-party domain.
 */
test('a crafted next= parameter on login cannot redirect off-platform, in either the POST handler or the already-logged-in page redirect', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)

  // Case 1: POST /auth/login with a backslash-based bypass attempt, on a
  // real successful login (so the vulnerable next-redirect branch, which
  // only runs after a successful signInWithPassword, is actually reached).
  const postRes = await page.request.post(`${b2bBase}/auth/login`, {
    form: {
      email: user.email,
      password: user.password,
      next: '/\\evil.com',
    },
    maxRedirects: 0,
  })
  expect(postRes.status()).toBeGreaterThanOrEqual(300)
  expect(postRes.status()).toBeLessThan(400)
  const postLocation = postRes.headers()['location']
  expect(postLocation).toBeTruthy()
  expect(postLocation!).not.toContain('evil.com')

  // Case 1's POST above was a real successful login (valid credentials,
  // just an invalid `next`) -- it already established a real session in
  // this page's context (and browser-cookie jar, which page.request
  // shares), so case 2 can go straight at the already-logged-in path
  // without a separate login() call. (An earlier version of this test
  // called login() here too, which navigated to /login while already
  // authenticated -- the page component's own `if (user) redirect(...)`
  // fires immediately, so the login form's #email field never renders
  // and the helper times out waiting for it. Not a product bug, a test
  // ordering mistake.)

  // Case 2: an already-logged-in user visiting /login?next=<off-platform
  // URL> directly -- the page component's own redirect(), previously
  // completely unvalidated (not even the flawed startsWith check).
  const getRes = await page.request.get(`${b2bBase}/login?next=https://evil.com`, {
    maxRedirects: 0,
  })
  expect(getRes.status()).toBeGreaterThanOrEqual(300)
  expect(getRes.status()).toBeLessThan(400)
  const getLocation = getRes.headers()['location']
  expect(getLocation).toBeTruthy()
  expect(getLocation!).not.toContain('evil.com')
})

/**
 * SEC-040 (2026-09-05): the collaborators view lost security_invoker=true
 * when 089_peer_projects.sql recreated it (CREATE OR REPLACE VIEW does
 * not preserve reloptions from the version it replaces), reverting it to
 * run as its owner (postgres, RLS-bypassing) instead of the querying
 * user -- combined with anon's standard PostgREST SELECT grant, a
 * completely unauthenticated request returned real cross-user
 * collaboration pairs platform-wide, stackworks/flexpro included. Fixed
 * via 115_fix_collaborators_security_invoker.sql. This is a pure
 * infra/schema check (no signup needed) so it belongs here, not in a
 * per-app suite.
 *
 * CORRECTED 2026-09-07 (caught by a full-suite run): this test's
 * original "zero rows, period" assertion went stale, not the schema --
 * security_invoker=true is still correctly set (confirmed directly:
 * `security_invoker` remains in the view's reloptions) and continues to
 * correctly hide every real stackworks/flexpro row from anon, which is
 * what SEC-040 actually protects. What changed is peer_project_members'
 * OWN RLS policy ("Confirmed members are public...") -- a later,
 * separate, deliberate design decision (peer-projects feature build,
 * per its own documented "the peer-confirmed project list itself is
 * public to any viewer" scope) that this view's 'peer' UNION branch now
 * correctly, faithfully propagates through security_invoker to anon
 * requests too, exactly as it's supposed to. Narrowed to assert the
 * real invariant (no stackworks/flexpro row ever reaches anon) instead
 * of a blanket zero-rows count that a later, unrelated, intentional
 * feature was always going to break.
 */
test('the collaborators view never returns stackworks/flexpro data to a completely unauthenticated request', async ({ request }) => {
  const res = await request.get(`${SUPABASE_URL}/rest/v1/collaborators?select=pillar`, {
    headers: { apikey: ANON_KEY },
  })
  expect(res.ok()).toBeTruthy()
  const rows = await res.json()
  expect(Array.isArray(rows)).toBe(true)
  // 'peer' rows are legitimately public (peer_project_members' own RLS,
  // a separate, deliberate decision) -- anything else would mean
  // SEC-040 itself has actually regressed.
  expect(rows.every((r: { pillar: string }) => r.pillar === 'peer')).toBe(true)
})
