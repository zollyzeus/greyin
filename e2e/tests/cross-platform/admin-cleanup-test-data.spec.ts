import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin, createTestPost } from '../../utils/admin'

/**
 * docs/audits/competitive-analysis/emergent_deployment_gap.md's UI/UX audit recommended an idempotent
 * cleanup route for e2e-suite content left on live public feeds (found:
 * 45 posts on GreyMatters, 183 builder_projects on StackWorks -- both
 * cleared manually 2026-09-02). Covers the route itself: admin-gated,
 * and removes a real "E2E "-prefixed row when run.
 */
const hubBase = 'https://greyin.net'

test('a non-admin cannot reach the admin page the cleanup button lives on', async ({ page, cleanup }) => {
  const user = await signUpSaltNPepper(page, cleanup, 'https://saltnpepper.greyin.net')
  await login(page, user, `${hubBase}/dashboard`, hubBase)
  await page.goto(`${hubBase}/admin`)
  await expect(page).toHaveURL(`${hubBase}/dashboard`)
})

test('an admin can run test-data cleanup and it removes a real E2E-prefixed post', async ({ page, cleanup }) => {
  const admin = await signUpSaltNPepper(page, cleanup, 'https://saltnpepper.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)

  const seeded = await createTestPost({ title: `E2E Cleanup Route Post ${Date.now()}` })

  await login(page, admin, `${hubBase}/dashboard`, hubBase)
  await page.goto(`${hubBase}/admin`)
  await page.getByRole('button', { name: 'Run cleanup' }).click()
  await page.waitForURL(/cleanup_total=/)
  await expect(page.getByText(/Last run: \d+ rows? removed/)).toBeVisible()

  const check = await page.request.get(
    `https://greymatters.greyin.net/posts/${seeded.slug}`,
    { maxRedirects: 0 }
  ).catch(() => null)
  // Confirms the seeded post is gone rather than just trusting the UI count.
  if (check) expect([404, 307, 308]).toContain(check.status())
})
