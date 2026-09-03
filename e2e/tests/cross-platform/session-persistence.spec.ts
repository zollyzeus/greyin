import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * Two things confirmed by direct inspection before writing these (see
 * conversation, not repeated in code): there is no inactivity-based
 * session timeout anywhere in this stack (no GOTRUE_SESSIONS_* env var,
 * no custom last-activity tracking), and the auth cookie Set-Cookie
 * header carries an Expires ~1000 years out (Supabase's default) rather
 * than being a browser-session-only cookie. Both tests here lock in that
 * *actual* behavior as a regression guard -- not a feature that log-out-
 * after-idle or log-out-on-close exists, but that staying signed in
 * across a closed browser is the deliberate, working default.
 */
test('closing the browser entirely and reopening it still leaves the session signed in', async ({ browser, cleanup }) => {
  const setupCtx = await browser.newContext()
  const setupPage = await setupCtx.newPage()
  const user = await signUpDeepEdge(setupPage, 'candidate', cleanup)
  await login(setupPage, user, '/dashboard')

  // storageState captures cookies exactly as a real browser would persist
  // them to disk -- reusing it in a brand new context is the practical
  // equivalent of quitting the browser and relaunching it later, not
  // just closing one tab within the same running browser.
  const storageState = await setupCtx.storageState()
  await setupCtx.close()

  const reopenedCtx = await browser.newContext({ storageState })
  const reopenedPage = await reopenedCtx.newPage()
  await reopenedPage.goto('/dashboard')
  await expect(reopenedPage).toHaveURL('/dashboard')
  await expect(reopenedPage.getByText('Welcome back')).toBeVisible()

  await reopenedCtx.close()
})

test('logging in after being redirected to /login returns to the original page, not just the default dashboard', async ({ page, cleanup }) => {
  // Not every protected page preserves `next` through its redirect --
  // that's a real, pre-existing inconsistency across ~19 protected pages
  // (e.g. /profile just does redirect('/login'), dropping it), but
  // fixing all of those is a separate piece of work from this test.
  // /enterprise-contact is one of the handful that does it correctly,
  // hence the employer signup below rather than a plain candidate.
  await page.goto('/enterprise-contact')
  await expect(page).toHaveURL(/\/login\?next=%2Fenterprise-contact/)

  const user = await signUpDeepEdge(page, 'employer', cleanup)
  // signUpDeepEdge already lands the browser on /verify -- the ?next
  // param from the earlier redirect was dropped by navigating to /signup
  // along the way, which is correct (signup's own destination isn't the
  // login redirect's concern). This test cares about the /login round
  // trip specifically, so re-drive it directly against the now-confirmed
  // account instead.
  await page.goto('/login?next=/enterprise-contact')
  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('/enterprise-contact')
  await expect(page).toHaveURL('/enterprise-contact')
})
