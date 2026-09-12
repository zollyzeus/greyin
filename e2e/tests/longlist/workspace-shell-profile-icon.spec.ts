import { test, expect } from '../../utils/fixtures'
import { signUpLongList, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

/**
 * Platform-wide icon-sync audit (2026-09-12): every other pillar's rail
 * uses the Settings (gear) icon for its Profile link; Longlist alone used
 * Send (a paper-plane), a leftover mismatch from whenever its rail was
 * first built. Asserted via lucide-react's own auto-added
 * `lucide-<kebab-name>` class rather than guessing at SVG path data.
 */
test('the rail\'s Profile link uses the same Settings icon every other pillar uses', async ({ page, cleanup }) => {
  const candidate = await signUpLongList(page, cleanup)
  await login(page, candidate, '/dashboard')

  const rail = page.locator('aside').first()
  const profileLink = rail.getByRole('link', { name: 'Profile' })
  await expect(profileLink.locator('svg.lucide-settings')).toBeVisible()
  await expect(profileLink.locator('svg.lucide-send')).toHaveCount(0)
})

/**
 * Sidebar-organization request (2026-09-12): Feed-first/Profile-last
 * applies everywhere else on the platform, but Longlist has no Feed
 * feature at all -- Dashboard stays the practical first item here, and
 * Profile stays last.
 */
test('the rail lists Dashboard first (no Feed exists here) and Profile last', async ({ page, cleanup }) => {
  const candidate = await signUpLongList(page, cleanup)
  await login(page, candidate, '/dashboard')
  const links = await page.locator('aside').first().locator('nav > div').first().locator('a').allTextContents()
  expect(links[0]).toContain('Dashboard')
  expect(links[links.length - 1]).toContain('Profile')
})

/**
 * Real gap investigated 2026-09-12: Longlist's moderation lives
 * entirely in Greyin Hub's /admin/longlist (migration 140, 2026-09-08),
 * but this app's own rail never got an Admin item pointing there --
 * an admin looking at Longlist itself had zero indication any
 * moderation capability existed for this pillar, unlike every other
 * app's rail (a visible, self-evident Admin link to its OWN /admin).
 * Fixed with a plain external <a> (not a Next <Link>) to the Hub's URL,
 * in the same separated-section-above-Across-Greyin style as the other
 * apps' local Admin links.
 */
test('an admin sees an Admin link pointing to Greyin Hub\'s Longlist moderation panel', async ({ page, cleanup }) => {
  const admin = await signUpLongList(page, cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(page, admin, '/dashboard')

  const rail = page.locator('aside').first()
  const adminLink = rail.getByRole('link', { name: 'Admin' })
  await expect(adminLink).toBeVisible()
  await expect(adminLink).toHaveAttribute('href', 'https://greyin.net/admin/longlist')

  // Separated from the main nav list, directly above Across Greyin --
  // same convention as the other apps' local Admin link.
  const sectionBeforeEcosystem = rail.locator('[data-tour="ecosystem"]').locator('xpath=preceding-sibling::div[1]')
  await expect(sectionBeforeEcosystem.getByRole('link', { name: 'Admin' })).toBeVisible()
})

test('a non-admin does not see an Admin link in the Longlist rail', async ({ page, cleanup }) => {
  const member = await signUpLongList(page, cleanup)
  await login(page, member, '/dashboard')

  await expect(page.locator('aside').first().getByRole('link', { name: 'Admin' })).toHaveCount(0)
})
