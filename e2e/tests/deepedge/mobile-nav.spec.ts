import { test, expect } from '@playwright/test'

/**
 * The audit found every app's header nav hidden entirely on mobile
 * (`hidden md:flex`) with no replacement -- phone visitors couldn't sign
 * in, sign up, or navigate at all. This verifies the new SiteHeader's
 * hamburger menu actually opens and exposes the same destinations.
 */
test('the mobile menu opens and exposes sign in / sign up', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  // Scoped to the mobile nav specifically (`nav.md:hidden`, the header's
  // own second <nav>) rather than a bare page-wide locator + .first()/
  // .last() -- the common footer (2026-09-03) repeats several of these
  // same link texts (Browse Jobs, Sign In doesn't collide but Browse
  // Jobs does), so DOM-order tricks against "whichever nav renders last"
  // stopped being reliable once a third copy (the footer) entered the
  // page.
  const mobileNav = page.locator('nav.md\\:hidden')
  await expect(mobileNav).toBeHidden()

  await page.getByRole('button', { name: 'Open menu' }).click()

  await expect(mobileNav.getByRole('link', { name: 'Sign In' })).toBeVisible()
  await expect(mobileNav.getByRole('link', { name: 'Get Started' })).toBeVisible()

  // Pillar-specific links (Browse Jobs etc.) live one level deeper, under
  // the mobile menu's own "Explore" toggle.
  await mobileNav.getByRole('button', { name: 'Explore' }).click()
  await expect(mobileNav.getByRole('link', { name: 'Browse Jobs' })).toBeVisible()
})
