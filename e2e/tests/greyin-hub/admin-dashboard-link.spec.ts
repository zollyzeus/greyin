import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

/**
 * Platform-wide admin (wishlist, feedback, LLM config, threshold votes,
 * peer-project moderation) lives only on the Hub -- but until now, the
 * Hub was the one app with no visible link to its own /admin anywhere
 * (every other pillar app with its own /admin surfaces a card on its
 * dashboard the same way). A real admin had no way to discover it short
 * of typing the URL directly -- found via a direct user report ("why am
 * I not seeing admin panel on login?").
 */
test('a real admin sees a link to /admin on the Hub dashboard, and it actually works', async ({ page, cleanup }) => {
  const admin = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(page, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  const adminCard = page.getByRole('link', { name: /Admin/ }).first()
  await expect(adminCard).toBeVisible()
  await adminCard.click()
  await page.waitForURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: /Admin/i }).first()).toBeVisible()
})

test('a regular member does not see the admin link', async ({ page, cleanup }) => {
  const member = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  await login(page, member, 'https://greyin.net/dashboard', 'https://greyin.net')

  await expect(page.getByRole('link', { name: /Admin/ })).toHaveCount(0)
})

/**
 * The dashboard card above was still the ONLY reachable link -- any other
 * Hub page (pivoting, reentry, an admin sub-page navigated to directly)
 * had no way back to /admin short of re-visiting /dashboard or typing the
 * URL. SiteHeader.tsx (rendered on every Hub page) now fetches the
 * viewer's own role and shows a persistent "Admin" nav link, same as the
 * per-app WorkspaceShell rail's own admin item.
 */
test('the persistent header shows an Admin link on pages other than the dashboard', async ({ page, cleanup }) => {
  const admin = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(page, admin, 'https://greyin.net/dashboard', 'https://greyin.net')
  await page.goto('https://greyin.net/pivoting')

  const headerAdminLink = page.locator('header').getByRole('link', { name: 'Admin' })
  await expect(headerAdminLink).toBeVisible()
  await headerAdminLink.click()
  await page.waitForURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: /Admin/i }).first()).toBeVisible()
})
