import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * Audit finding: every app's SiteHeader rendered "Sign In" / "Sign Up"
 * unconditionally, regardless of session state -- worst on greyin-hub's
 * own /dashboard, a login-required page that still showed "Sign In" to
 * someone who, by definition, was already signed in to see it. Fixed by
 * having SiteHeader check its own session client-side; this proves the
 * fix holds across the SSO session on multiple apps, not just the one
 * where the bug was first noticed.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const hubBase = isLocal
  ? `http://localhost:${process.env.E2E_HUB_PORT || 3105}`
  : 'https://greyin.net'
const stackworksBase = isLocal
  ? `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}`
  : 'https://stackworks.greyin.net'

test('once logged in, no app header shows "Sign In" again -- checked on the hub dashboard and across the SSO session', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, user, '/dashboard')

  // Scoped to the header specifically -- expertedge and the hub both
  // also carry a CTA-section "Go to Dashboard" link now (a separate fix,
  // see the homepage CTA audit), which shares the substring "Dashboard"
  // and would make an unscoped check ambiguous.
  const header = page.locator('header')

  // The originally-reported bug: greyin-hub's own /dashboard, reachable
  // only while logged in, showing "Sign In" anyway.
  await page.goto(`${hubBase}/dashboard`)
  await expect(page).toHaveURL(`${hubBase}/dashboard`)
  await expect(header.getByRole('link', { name: 'Sign In' })).not.toBeVisible()
  await expect(page.locator('form[action="/auth/logout"] button')).toBeVisible()

  // Same SSO session, a different app's public homepage -- the header
  // there should also recognize the session instead of defaulting to
  // logged-out copy.
  await page.goto(stackworksBase)
  await expect(page.locator('header').getByRole('link', { name: 'Sign In' })).not.toBeVisible()
  await expect(page.locator('header').getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible()

  // And back on deepedge.greyin.net itself (this test's own baseURL).
  await page.goto('/')
  await expect(page.locator('header').getByRole('link', { name: 'Sign In' })).not.toBeVisible()
  await expect(page.locator('header').getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible()
})

test('logged out, the hub dashboard redirects and every header still offers Sign In', async ({ page }) => {
  await page.goto(`${hubBase}/dashboard`)
  await expect(page).toHaveURL(/\/login\?next=\/dashboard/)

  await page.goto(stackworksBase)
  await expect(page.locator('header').getByRole('link', { name: 'Sign In' })).toBeVisible()
})
