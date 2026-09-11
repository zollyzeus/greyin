import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

/**
 * The consolidated admin panel's shell (Phase 3, pitch-readiness plan)
 * -- admin/layout.tsx now does the auth+role check ONCE for the whole
 * /admin/* tree (previously duplicated per-page); this is the
 * regression guard that the consolidation didn't quietly drop
 * protection on a tab that never had its own page-level check before
 * (every ported pillar page has no redirect logic of its own -- the
 * layout is the only gate).
 */
test('a non-admin is redirected away from a ported pillar tab, not just the original /admin page', async ({ page, cleanup }) => {
  const member = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  await login(page, member, 'https://greyin.net/dashboard', 'https://greyin.net')

  await page.goto('/admin/deepedge')
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('the Overview tab renders real, live moderation-volume counts', async ({ page, cleanup }) => {
  const admin = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(page, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  await page.goto('/admin/overview')
  await expect(page.getByText('Open jobs')).toBeVisible()
  await expect(page.getByText('Active gigs')).toBeVisible()
  await expect(page.getByText('Total users')).toBeVisible()
  await expect(page.getByRole('link', { name: /AI Matching Bias Audit/ })).toBeVisible()
})
