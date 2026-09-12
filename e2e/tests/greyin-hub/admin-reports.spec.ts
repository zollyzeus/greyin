import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
}

/**
 * Centralized moderation queue for content_reports (152) -- one shared
 * table across every reportable content type (company reviews, DMs,
 * GreyMatters comments) rather than three separate per-pillar UIs.
 * Every report also pages every admin via the existing shared
 * notifications bell at submit time.
 */
test('an admin can resolve an open content report from the centralized queue', async ({ page, cleanup }) => {
  const admin = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)

  const reporter = await getUserIdByEmail((await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')).email)

  const reason = `E2E admin-reports queue reason ${Date.now()}`
  await fetch(`${SUPABASE_URL}/rest/v1/content_reports`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ reporter_id: reporter, content_type: 'greymatters_comment', content_id: '00000000-0000-0000-0000-000000000000', reason, status: 'open' }),
  })

  await login(page, admin, 'https://greyin.net/dashboard', 'https://greyin.net')
  await page.goto('https://greyin.net/admin/reports')
  await expect(page.getByText(reason)).toBeVisible()

  const reportBlock = page.getByText(reason).locator('xpath=ancestor::div[contains(@class,"py-4")][1]')
  await reportBlock.getByRole('button', { name: 'Mark resolved' }).click()
  await page.waitForURL(/\/admin\/reports$/)

  // Resolved reports move to the "Recently resolved" section, not the
  // open-reports list -- the reason text itself may still appear there,
  // so assert on the real end state (DB status) rather than visibility.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/content_reports?reason=eq.${encodeURIComponent(reason)}&select=status,resolved_by`, {
    headers: restHeaders(),
  })
  const [row] = await res.json()
  expect(row.status).toBe('resolved')
  expect(row.resolved_by).toBe(adminId)
})

test('a non-admin cannot reach the reports queue', async ({ page, cleanup }) => {
  const member = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  await login(page, member, 'https://greyin.net/dashboard', 'https://greyin.net')
  await page.goto('https://greyin.net/admin/reports')
  await page.waitForURL(/greyin\.net\/dashboard$/)
})
