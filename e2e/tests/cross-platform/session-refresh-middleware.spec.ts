import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * Regression test for a real production bug report (2026-08-24): a user
 * logged in via Greyin Hub found logout "not working" and SSO "not
 * working by default" when navigating to other pillars. Root cause: every
 * app's lib/supabase/server.ts cookie set()/remove() has a comment saying
 * failures there "can be ignored if you have middleware refreshing user
 * sessions" -- but only deepedge actually had that middleware.ts. The
 * other 5 apps (including Greyin Hub, the app in the report) had no
 * middleware calling supabase.auth.getUser() on every request, so an
 * expiring access token's refreshed Set-Cookie never made it back to the
 * browser during ordinary Server Component renders.
 *
 * sso.spec.ts and logout-flow.spec.ts both do a fresh login immediately
 * followed by a single action -- too short-lived to ever need a token
 * refresh, so neither caught this. This spec is deliberately shaped
 * differently: it chains several real cross-origin navigations (each one
 * a separate request through each app's own middleware) before checking
 * the session is still recognized everywhere, and it verifies logout
 * actually clears the shared cookie from the browser (not just that the
 * page redirects), including on a second app after logging out from the
 * first. Not redundant with sso.spec.ts/logout-flow.spec.ts -- this is
 * the multi-hop/middleware-specific case those don't exercise.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const cookieDomain = isLocal ? 'localhost' : '.greyin.net'

const hubBase = isLocal ? `http://localhost:${process.env.E2E_HUB_PORT || 3105}` : 'https://greyin.net'
const greymattersBase = isLocal ? `http://localhost:${process.env.E2E_GREYMATTERS_PORT || 3101}` : 'https://greymatters.greyin.net'
const flexproBase = isLocal ? `http://localhost:${process.env.E2E_FREEAGENT_PORT || 3102}` : 'https://flexpro.greyin.net'
const saltnpepperBase = isLocal ? `http://localhost:${process.env.E2E_SALTNPEPPER_PORT || 3103}` : 'https://saltnpepper.greyin.net'
const stackworksBase = isLocal ? `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}` : 'https://stackworks.greyin.net'

function authCookies(cookies: { name: string; domain: string; value: string }[]) {
  return cookies.filter((c) => c.name.startsWith('sb-'))
}

test('a session survives multiple real cross-pillar hops starting from Greyin Hub, and logging out from Hub clears it everywhere', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, user, '/dashboard')

  const initialCookies = authCookies(await page.context().cookies())
  expect(initialCookies.length).toBeGreaterThan(0)
  expect(initialCookies.every((c) => c.domain === cookieDomain)).toBe(true)

  // Land on Greyin Hub via SSO first -- this is the app named in the bug
  // report ("greyin homepage"/"greyin dashboard").
  await page.goto(`${hubBase}/dashboard`)
  await expect(page).toHaveURL(`${hubBase}/dashboard`)
  await expect(page.locator('form[action="/auth/login"]')).toHaveCount(0)

  // Chain several more real cross-origin hops -- each one is a fresh
  // request through that app's own middleware (or lack thereof, pre-fix).
  // A single hop wouldn't reliably exercise a token-refresh gap; several
  // in sequence gives the session more real requests to go stale across.
  for (const base of [greymattersBase, flexproBase, saltnpepperBase, stackworksBase, hubBase]) {
    await page.goto(`${base}/dashboard`)
    await expect(page).toHaveURL(`${base}/dashboard`)
    await expect(page.locator('form[action="/auth/login"]')).toHaveCount(0)
  }

  // The real assertion for the "logout not working" half of the report:
  // signing out from Hub must actually clear the shared cookie, not just
  // redirect this one page.
  const signOutButton = page.locator('form[action="/auth/logout"] button').first()
  await expect(signOutButton).toBeVisible()
  await signOutButton.click()
  await page.waitForURL(/\/login/, { timeout: 10_000 })

  const cookiesAfterLogout = authCookies(await page.context().cookies())
  expect(cookiesAfterLogout.length).toBe(0)

  // Revisiting Hub's own dashboard must bounce, not render.
  await page.goto(`${hubBase}/dashboard`)
  await expect(page).toHaveURL(new RegExp(`${hubBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/login`))

  // And the logout must have propagated to the shared session, not just
  // Hub's own local view of it -- a second pillar must also bounce.
  await page.goto(`${stackworksBase}/dashboard`)
  await expect(page).toHaveURL(new RegExp(`${stackworksBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/login`))
})
