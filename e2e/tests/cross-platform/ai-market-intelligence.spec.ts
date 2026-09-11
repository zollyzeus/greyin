import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

const isLocal = process.env.E2E_TARGET === 'local'
const greyinHubBase = isLocal ? `http://localhost:${process.env.E2E_GREYIN_HUB_PORT || 3107}` : 'https://greyin.net'

/**
 * AI enhancement (Phase C3, "11 new AI enhancements" plan): admin-only
 * market-intelligence report. Unlike C1/C2, this is generated on a
 * schedule (a 24h timer in greyin-hub's instrumentation.ts), not
 * live/on-demand -- so this spec manually triggers generation via the
 * same "Generate now" button an admin would click, rather than waiting
 * on the timer, matching the plan's own "call the RPC/function directly"
 * verification convention already used for refresh_platform_score_means().
 *
 * Also covers the same access-control shape as every other admin-only
 * aggregate page this session (bias-audit, job-recommendation-feedback):
 * a non-admin is redirected away, never sees the report or raw stats.
 */
test('admin can generate and view the market-intelligence report; a non-admin cannot reach it', async ({ browser, cleanup }) => {
  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const adminUser = await signUpSaltNPepper(adminPage, cleanup, 'https://saltnpepper.greyin.net')
  const adminId = await getUserIdByEmail(adminUser.email)
  await promoteToAdmin(adminId)
  await login(adminPage, adminUser, 'https://saltnpepper.greyin.net/dashboard', 'https://saltnpepper.greyin.net')

  await adminPage.goto(`${greyinHubBase}/admin/market-intelligence`)
  await expect(adminPage.getByRole('heading', { name: 'Market Intelligence' })).toBeVisible()

  await adminPage.getByRole('button', { name: 'Generate now' }).click()
  await adminPage.waitForURL(/\/admin\/market-intelligence/)

  await expect(adminPage.getByText('No report generated yet.')).not.toBeVisible()
  await expect(adminPage.getByText(/Generated /)).toBeVisible()

  await adminPage.getByText('Raw stats').click()
  const rawStats = adminPage.locator('pre')
  await expect(rawStats).toContainText('top_skills_in_demand')
  await expect(rawStats).toContainText('hiring_velocity')
  await adminCtx.close()

  const strangerCtx = await browser.newContext()
  const strangerPage = await strangerCtx.newPage()
  const stranger = await signUpSaltNPepper(strangerPage, cleanup, 'https://saltnpepper.greyin.net')
  await login(strangerPage, stranger, 'https://saltnpepper.greyin.net/dashboard', 'https://saltnpepper.greyin.net')

  await strangerPage.goto(`${greyinHubBase}/admin/market-intelligence`)
  await strangerPage.waitForURL(`${greyinHubBase}/dashboard`)
  await expect(strangerPage.getByRole('heading', { name: 'Market Intelligence' })).not.toBeVisible()
  await strangerCtx.close()
})
