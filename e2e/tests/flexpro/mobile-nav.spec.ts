import { test, expect } from '@playwright/test'

/**
 * The audit found the homepage nav missing a signup CTA at all (only
 * "Browse Gigs" / "Sign In"), while inner pages had a "Join Now" button
 * -- inconsistent, and neither had mobile behavior. This verifies the
 * shared header's mobile menu is consistent and actually opens.
 */
test('the mobile menu opens and exposes join now', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  // Scoped to the mobile nav specifically (`nav.md:hidden`) rather than a
  // bare page-wide locator + .first()/.last() -- the common footer
  // (2026-09-03) repeats several of these same link texts (Browse Gigs),
  // so DOM-order tricks against "whichever nav renders last" stopped
  // being reliable once a third copy (the footer) entered the page.
  const mobileNav = page.locator('nav.md\\:hidden')
  await expect(mobileNav).toBeHidden()

  await page.getByRole('button', { name: 'Open menu' }).click()

  await expect(mobileNav.getByRole('link', { name: 'Sign In' })).toBeVisible()
  await expect(mobileNav.getByRole('link', { name: 'Join Now' })).toBeVisible()

  // Pillar-specific links (Browse Gigs etc.) live one level deeper, under
  // the mobile menu's own "Explore" toggle.
  await mobileNav.getByRole('button', { name: 'Explore' }).click()
  await expect(mobileNav.getByRole('link', { name: 'Browse Gigs' })).toBeVisible()
})
