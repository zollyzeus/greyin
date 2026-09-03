import { test, expect } from '@playwright/test'

/**
 * The audit's mobile screenshot showed the "Salt & Pepper" wordmark
 * line-wrapping under its own icon with "Join Community" unreadable --
 * the old header just let the flex row overflow instead of collapsing.
 */
test('the mobile menu opens and exposes join community', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  // Scoped to the mobile nav specifically (`nav.md:hidden`) rather than a
  // bare page-wide locator + .first()/.last() -- the common footer
  // (2026-09-03) repeats several of these same link texts (Discussions),
  // so DOM-order tricks against "whichever nav renders last" stopped
  // being reliable once a third copy (the footer) entered the page.
  const mobileNav = page.locator('nav.md\\:hidden')
  await expect(mobileNav).toBeHidden()

  await page.getByRole('button', { name: 'Open menu' }).click()

  await expect(mobileNav.getByRole('link', { name: 'Sign In' })).toBeVisible()
  await expect(mobileNav.getByRole('link', { name: 'Join Community' })).toBeVisible()

  // Pillar-specific links (Discussions etc.) live one level deeper, under
  // the mobile menu's own "Explore" toggle.
  await mobileNav.getByRole('button', { name: 'Explore' }).click()
  await expect(mobileNav.getByRole('link', { name: 'Discussions' })).toBeVisible()
})
