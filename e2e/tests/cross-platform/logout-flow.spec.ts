import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * Follow-up to header-auth-state.spec.ts's discovery that SiteHeader
 * across every app used to show "Sign In" unconditionally. That fix
 * covered header *display*; this covers the actual logout *action* --
 * each of the 6 apps has its own separate /auth/logout route.ts file
 * (functionally identical, but genuinely separate deployed code -- this
 * is exactly the class of bug that let greyin-hub ship with no logout
 * route at all until this audit). Verifies, per app: the Sign Out button
 * is reachable and correctly labeled, clicking it actually clears the
 * shared SSO session (not just navigates away), and a subsequently
 * revisited protected page redirects to login rather than rendering.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const apps: Array<{ name: string; base: string; dashboard: string }> = isLocal
  ? [
      { name: 'DeepEdge', base: `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}`, dashboard: '/dashboard' },
      { name: 'GreyMatters', base: `http://localhost:${process.env.E2E_GREYMATTERS_PORT || 3101}`, dashboard: '/dashboard' },
      { name: 'FlexPro', base: `http://localhost:${process.env.E2E_FREEAGENT_PORT || 3102}`, dashboard: '/dashboard' },
      { name: 'Salt & Pepper', base: `http://localhost:${process.env.E2E_SALTNPEPPER_PORT || 3103}`, dashboard: '/dashboard' },
      { name: 'StackWorks', base: `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}`, dashboard: '/dashboard' },
      { name: 'Greyin Hub', base: `http://localhost:${process.env.E2E_HUB_PORT || 3105}`, dashboard: '/dashboard' },
    ]
  : [
      { name: 'DeepEdge', base: 'https://deepedge.greyin.net', dashboard: '/dashboard' },
      { name: 'GreyMatters', base: 'https://greymatters.greyin.net', dashboard: '/dashboard' },
      { name: 'FlexPro', base: 'https://flexpro.greyin.net', dashboard: '/dashboard' },
      { name: 'Salt & Pepper', base: 'https://saltnpepper.greyin.net', dashboard: '/dashboard' },
      { name: 'StackWorks', base: 'https://stackworks.greyin.net', dashboard: '/dashboard' },
      { name: 'Greyin Hub', base: 'https://greyin.net', dashboard: '/dashboard' },
    ]

for (const app of apps) {
  test(`signing out from ${app.name} clears the shared session, not just the page`, async ({ page, cleanup }) => {
    // Fresh account per app rather than one shared login re-used across
    // the loop -- each iteration ends by actually signing out, so the
    // next one needs its own real session anyway; a fresh signup+login
    // is the same cost as a bare login call here and keeps each
    // iteration independent (one flaky iteration can't cascade into the
    // next app's setup).
    const user = await signUpDeepEdge(page, 'candidate', cleanup)
    await login(page, user, '/dashboard')

    await page.goto(`${app.base}${app.dashboard}`)
    await expect(page).toHaveURL(`${app.base}${app.dashboard}`)

    // Not scoped to button[type="submit"] -- the pillar apps' own
    // hand-rolled dashboard headers (distinct from SiteHeader) rely on a
    // bare <button> defaulting to type=submit inside its <form>, which
    // works correctly for a real click but wouldn't match that stricter
    // selector.
    const signOutButton = page.locator('form[action="/auth/logout"] button').first()
    await expect(signOutButton).toBeVisible()
    await signOutButton.click()
    await page.waitForURL(/\/login/, { timeout: 10_000 })

    // The real assertion: the shared .greyin.net session is actually
    // gone, not just that this one click navigated to /login. Revisiting
    // the same app's protected dashboard should bounce, not render.
    await page.goto(`${app.base}${app.dashboard}`)
    await expect(page).toHaveURL(new RegExp(`${app.base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/login`))
  })
}
