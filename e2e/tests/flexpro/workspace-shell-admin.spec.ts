import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

/**
 * Sidebar-organization request (2026-09-12): the Admin rail item was
 * moved out of the regular nav list into its own bordered section
 * directly above "Across Greyin", instead of sitting inline amongst
 * Dashboard/Gigs/Orders/etc. Asserted via DOM order, not just
 * visibility, so a regression back to inline placement would be caught.
 */
test('an admin sees the Admin link in its own separated section, directly above Across Greyin', async ({ page, cleanup }) => {
  const admin = await signUpFlexPro(page, 'freelancer', cleanup)
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
  const freelancer = await signUpFlexPro(page, 'freelancer', cleanup)
  await login(page, freelancer, '/dashboard')

  await expect(page.locator('aside').first().getByRole('link', { name: 'Admin' })).toHaveCount(0)
})

/**
 * Sidebar-organization request (2026-09-12): Feed first, Profile last,
 * everything else sequenced by usage frequency/impact.
 */
test('the rail lists Feed first and Profile last', async ({ page, cleanup }) => {
  const freelancer = await signUpFlexPro(page, 'freelancer', cleanup)
  await login(page, freelancer, '/dashboard')
  const links = await page.locator('aside').first().locator('nav > div').first().locator('a').allTextContents()
  expect(links[0]).toContain('Feed')
  expect(links[links.length - 1]).toContain('Profile')
})
