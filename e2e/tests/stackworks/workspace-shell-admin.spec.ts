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
