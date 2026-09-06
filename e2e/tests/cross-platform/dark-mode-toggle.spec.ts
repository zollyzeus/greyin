import { test, expect } from '../../utils/fixtures'

/**
 * Light/dark mode (FR-PW-40/41/42, 2026-09-04) -- built as a foundation
 * pass (shared chrome + homepages) then two same-day follow-ups (all 169
 * inner pages, then the 16 inline-header pages the first follow-up
 * missed). No permanent regression coverage existed for any of it until
 * now; every prior check was a one-off manual Playwright script run
 * against prod and discarded.
 *
 * A third "color" (navy+gold) state was added and then reverted the same
 * day, 2026-09-05 -- shipped, screenshotted live on prod, found to clash
 * with the 5 pillar apps' own saturated hero bands (only DeepEdge and
 * Greyin Hub looked finished), and rolled back at user direction in
 * favor of focusing on the existing light/dark pair. See
 * docs/ui_ux_elevation_plan.md's dated update for the full account and
 * screenshots. This spec is back to the original binary check.
 *
 * Lives here, not under a single app's own tests/<app>/, because it
 * exercises all 7 domains -- matching this suite's own established
 * convention for cross-app specs. No signup/login needed: every page
 * checked here is a public route, and the toggle itself is unauthenticated
 * UI, so this avoids spending any of prod's GoTrue signup-rate budget on
 * a check that doesn't need an account at all.
 */
const isLocal = process.env.E2E_TARGET === 'local'

const APPS: Array<{ name: string; base: string }> = isLocal
  ? [
      { name: 'deepedge', base: `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}` },
      { name: 'greyin-hub', base: `http://localhost:${process.env.E2E_HUB_PORT || 3105}` },
      { name: 'greymatters', base: `http://localhost:${process.env.E2E_GREYMATTERS_PORT || 3101}` },
      { name: 'flexpro', base: `http://localhost:${process.env.E2E_FLEXPRO_PORT || 3102}` },
      { name: 'saltnpepper', base: `http://localhost:${process.env.E2E_SALTNPEPPER_PORT || 3103}` },
      { name: 'stackworks', base: `http://localhost:${process.env.E2E_STACKWORKS_PORT || 3104}` },
      { name: 'longlist', base: `http://localhost:${process.env.E2E_LONGLIST_PORT || 3106}` },
    ]
  : [
      { name: 'deepedge', base: 'https://deepedge.greyin.net' },
      { name: 'greyin-hub', base: 'https://greyin.net' },
      { name: 'greymatters', base: 'https://greymatters.greyin.net' },
      { name: 'flexpro', base: 'https://flexpro.greyin.net' },
      { name: 'saltnpepper', base: 'https://saltnpepper.greyin.net' },
      { name: 'stackworks', base: 'https://stackworks.greyin.net' },
      { name: 'longlist', base: 'https://longlist.greyin.net' },
    ]

for (const { name, base } of APPS) {
  test(`${name}: theme toggle applies dark mode and persists across reload`, async ({ page }) => {
    await page.goto(base, { waitUntil: 'networkidle' })

    // ThemeToggle is a client component that renders an inert placeholder
    // <span> (not a <button>) until its own useEffect resolves after
    // hydration -- 'networkidle' above gives that time to happen before
    // the check below, matching every ad-hoc verification script from
    // this feature's own build/rollout. Also present twice in the DOM at
    // once (SiteHeader's desktop-nav slot and its mobile-row slot, one
    // CSS-hidden by the other's breakpoint at any given viewport) --
    // .first() picks whichever one this viewport actually shows.
    const toggle = page.locator('button[aria-label*="dark mode"], button[aria-label*="light mode"]').first()
    await expect(toggle).toBeVisible()

    // Starts light (no explicit choice yet, and this runner's default
    // color scheme is light) -- clicking should add .dark and visibly
    // change the page background, not just flip an aria-label.
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await toggle.click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(3, 7, 18)')

    // The choice is meant to survive a reload via localStorage, applied
    // by the synchronous <head> script before first paint -- not just an
    // in-memory React state that would reset on navigation.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Toggling back returns to light and un-sets the persisted choice's
    // dark value, rather than only ever being able to turn dark mode on.
    const toggleBack = page.locator('button[aria-label*="light mode"]').first()
    await toggleBack.click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })
}
