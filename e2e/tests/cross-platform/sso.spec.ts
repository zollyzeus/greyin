import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, signUpSaltNPepper, login } from '../../utils/auth'

/**
 * The four apps share one Supabase project and now share a cookie domain
 * too — a session started on one app should already be recognized on
 * another without a separate login. This is the single highest-risk
 * change from this round (an earlier version of it broke client-side
 * Supabase auth entirely — see utils/auth.ts's client.ts comment for that
 * story), so it gets its own dedicated regression test rather than relying
 * only on manual verification.
 *
 * Against the isolated stack (E2E_TARGET=local, see
 * deployment/run-e2e-isolated.sh) the four apps are four different ports
 * on localhost rather than four subdomains, and NEXT_PUBLIC_COOKIE_DOMAIN
 * is set to plain "localhost" for that run — cookies scope by hostname,
 * not port, so the same mechanism still proves real cross-app SSO there.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const cookieDomain = isLocal ? 'localhost' : '.greyin.net'
const saltnpepperBase = isLocal
  ? `http://localhost:${process.env.E2E_SALTNPEPPER_PORT || 3103}`
  : 'https://saltnpepper.greyin.net'
const saltnpepperDashboard = `${saltnpepperBase}/dashboard`
const stackworksDashboard = isLocal
  ? `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}/dashboard`
  : 'https://stackworks.greyin.net/dashboard'

test('a session started on DeepEdge is recognized on Salt & Pepper without logging in there', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, user, '/dashboard')

  const cookies = await page.context().cookies()
  const authCookieDomains = [...new Set(cookies.filter((c) => c.name.startsWith('sb-')).map((c) => c.domain))]
  expect(authCookieDomains).toContain(cookieDomain)

  await page.goto(saltnpepperDashboard)
  // No login form should appear — landing directly on the dashboard proves
  // the session carried across without a second, separate authentication.
  await expect(page).toHaveURL(saltnpepperDashboard)
  await expect(page.locator('form[action="/auth/login"]')).toHaveCount(0)
})

/**
 * The concrete proof of StackWorks Phase 0's core claim: an existing Salt &
 * Pepper member (already 12+ years, already a Builder by definition) needs
 * zero stackworks-specific signup step. Deliberately never hits stackworks's own
 * /auth/login route here -- navigating straight to the dashboard on the
 * shared session cookie is the more precise test of "recognized via SSO
 * alone", since isBuilder() reads years_experience/stackworks_role directly
 * and doesn't depend on the pillar_memberships bookkeeping that route adds.
 */
test('a session started on Salt & Pepper is recognized on StackWorks, and the member can act as a Builder without a separate stackworks signup', async ({ page, cleanup }) => {
  // signUpSaltNPepper/login default to relative goto()s, which resolve
  // against this `cross-platform` project's own baseURL (deepedge) rather
  // than Salt & Pepper -- pass saltnpepperBase explicitly so both land on
  // the right app.
  const user = await signUpSaltNPepper(page, cleanup, saltnpepperBase)
  await login(page, user, saltnpepperDashboard, saltnpepperBase)

  await page.goto(stackworksDashboard)
  await expect(page).toHaveURL(stackworksDashboard)
  await expect(page.locator('form[action="/auth/login"]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Post a Project' })).toBeVisible()
})
