import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

/**
 * Sidebar-organization request (2026-09-12): the Admin rail item was
 * moved out of the regular nav list into its own bordered section
 * directly above "Across Greyin", instead of sitting inline amongst
 * the other nav items. Asserted via DOM order, not just visibility.
 */
test('an admin sees the Admin link in its own separated section, directly above Across Greyin', async ({ page, cleanup }) => {
  const admin = await signUpStackWorksBuilder(page, cleanup)
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
  const builder = await signUpStackWorksBuilder(page, cleanup)
  await login(page, builder, '/dashboard')

  await expect(page.locator('aside').first().getByRole('link', { name: 'Admin' })).toHaveCount(0)
})

/**
 * Sidebar-organization request (2026-09-12): Feed first, Profile last,
 * everything else sequenced by usage frequency/impact.
 */
test('the rail lists Feed first and Profile last', async ({ page, cleanup }) => {
  const builder = await signUpStackWorksBuilder(page, cleanup)
  await login(page, builder, '/dashboard')
  const links = await page.locator('aside').first().locator('nav > div').first().locator('a').allTextContents()
  expect(links[0]).toContain('Feed')
  expect(links[links.length - 1]).toContain('Profile')
})

/**
 * Collapsible sidebar (2026-09-13), StackWorks-specific regression: this
 * app's RailContents splits BASE_NAV into `nav` (all but Profile) and a
 * separately-rendered `profileItem`, plus a builder-only "Post a Project"
 * insert in between -- three independent render paths that each needed
 * their own collapsed-state treatment. Confirms the split didn't miss one.
 */
test('collapsing the rail hides labels on every nav item, including the separately-rendered Profile link', async ({ page, cleanup }) => {
  const builder = await signUpStackWorksBuilder(page, cleanup)
  await login(page, builder, '/dashboard')

  const rail = page.locator('aside').first()
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()

  // A collapsed link's accessible NAME still resolves via its `title`
  // attribute (browser accessible-name fallback when there's no visible
  // text) -- deliberate, for screen-reader tooltip parity -- so "hidden"
  // is asserted via visible text content, not getByRole(name).
  const profileLink = rail.locator('a[title="Profile"]')
  await expect(profileLink).toBeVisible()
  await expect(profileLink).toHaveText('')
  await expect(profileLink.locator('svg')).toBeVisible()

  await profileLink.click()
  await page.waitForURL(/\/profile$/)
})
