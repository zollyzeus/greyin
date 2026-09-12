import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

/**
 * Sidebar-organization request (2026-09-12): the Admin rail item was
 * moved out of the regular nav list into its own bordered section
 * directly above "Across Greyin", instead of sitting inline amongst
 * the other nav items. Asserted via DOM order, not just visibility.
 */
test('an admin sees the Admin link in its own separated section, directly above Across Greyin', async ({ page, cleanup }) => {
  const admin = await signUpGreyMatters(page, cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(page, admin, '/dashboard')

  const rail = page.locator('aside').first()
  const sectionBeforeEcosystem = rail.locator('[data-tour="ecosystem"]').locator('xpath=preceding-sibling::div[1]')
  const adminLink = sectionBeforeEcosystem.getByRole('link', { name: 'Admin' })
  await expect(adminLink).toBeVisible()

  await adminLink.click()
  await page.waitForURL(/\/admin$/)
})

test('a non-admin does not see an Admin link in the rail', async ({ page, cleanup }) => {
  const author = await signUpGreyMatters(page, cleanup)
  await login(page, author, '/dashboard')

  await expect(page.locator('aside').first().getByRole('link', { name: 'Admin' })).toHaveCount(0)
})

/**
 * Platform-wide pillar-icon-sync audit (2026-09-12): GreyMatters was the
 * one app rendering a plain color dot instead of the real pillar brand
 * icon (Building2/BookOpen/Users/Briefcase/FlaskConical/Telescope) in
 * both its rail's "Across Greyin" list and its own EcosystemWidget --
 * every other app's copy of these two components already used the real
 * icon. Asserted via lucide-react's own auto-added `lucide-<kebab-name>`
 * class (e.g. `lucide-book-open` for GreyMatters' own BookOpen icon)
 * rather than guessing at SVG path data.
 */
test('the rail\'s Across Greyin list and the EcosystemWidget show real pillar icons, not color dots', async ({ page, cleanup }) => {
  const author = await signUpGreyMatters(page, cleanup)
  await login(page, author, '/dashboard')

  const rail = page.locator('aside').first()
  const pillarNav = rail.getByTestId('pillar-nav')
  await expect(pillarNav.locator('a', { hasText: 'GreyMatters' }).locator('svg.lucide-book-open')).toBeVisible()
  await expect(pillarNav.locator('a', { hasText: 'DeepEdge' }).locator('svg.lucide-building2')).toBeVisible()
  // The old dot had no lucide class at all -- confirms it's really gone,
  // not just that an icon happens to also be present alongside it.
  await expect(pillarNav.locator('span.rounded-full')).toHaveCount(0)

  const ecosystemWidget = page.getByText('Your Greyin Ecosystem').locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
  await expect(ecosystemWidget.locator('a', { hasText: 'GreyMatters' }).locator('svg.lucide-book-open')).toBeVisible()
  await expect(ecosystemWidget.locator('span.rounded-full')).toHaveCount(0)
})

/**
 * Sidebar-organization request (2026-09-12): Feed first, Profile last,
 * everything else sequenced by usage frequency/impact.
 */
test('the rail lists Feed first and Profile last', async ({ page, cleanup }) => {
  const author = await signUpGreyMatters(page, cleanup)
  await login(page, author, '/dashboard')
  const links = await page.locator('aside').first().locator('nav > div').first().locator('a').allTextContents()
  expect(links[0]).toContain('Feed')
  expect(links[links.length - 1]).toContain('Profile')
})
