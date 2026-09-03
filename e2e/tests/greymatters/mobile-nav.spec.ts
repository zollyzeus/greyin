import { test, expect } from '@playwright/test'

/**
 * The audit's worst finding for this app: the homepage header had no
 * Sign In / Sign Up link at all, on any viewport. This verifies both are
 * now present and reachable on mobile via the new hamburger menu.
 */
test('the mobile menu opens and exposes sign in / sign up', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  // Scoped to the mobile nav specifically (`nav.md:hidden`) rather than a
  // bare page-wide locator + .first()/.last() -- the common footer
  // (2026-09-03) repeats several of these same link texts (Categories),
  // so DOM-order tricks against "whichever nav renders last" stopped
  // being reliable once a third copy (the footer) entered the page.
  const mobileNav = page.locator('nav.md\\:hidden')
  await expect(mobileNav).toBeHidden()

  await page.getByRole('button', { name: 'Open menu' }).click()

  await expect(mobileNav.getByRole('link', { name: 'Sign In' })).toBeVisible()
  await expect(mobileNav.getByRole('link', { name: 'Sign Up' })).toBeVisible()

  // Pillar-specific links (Categories etc.) live one level deeper, under
  // the mobile menu's own "Explore" toggle.
  await mobileNav.getByRole('button', { name: 'Explore' }).click()
  await expect(mobileNav.getByRole('link', { name: 'Categories' })).toBeVisible()
})
