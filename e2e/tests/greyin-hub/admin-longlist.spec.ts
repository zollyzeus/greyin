import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, getCompanyIdByUserId, promoteToAdmin } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  Prefer: 'return=representation',
  }
}

async function createTestFutureRole(companyId: string, postedBy: string): Promise<{ id: string; title: string }> {
  const title = `E2E Hub-Admin Future Role ${Date.now()}`
  const res = await fetch(`${SUPABASE_URL}/rest/v1/future_roles`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({
      company_id: companyId,
      posted_by: postedBy,
      title,
      target_timeframe: '6_months',
      description: 'Seeded by the Playwright e2e suite.',
    }),
  })
  if (!res.ok) throw new Error(`Failed to create test future role: ${res.status} ${await res.text()}`)
  const [row] = await res.json()
  return { id: row.id, title: row.title }
}

/**
 * Longlist's admin tab, built from scratch on Hub (Phase 3, pitch-
 * readiness plan) -- Longlist had no admin page at all before this.
 * Needed a new admin RLS bypass policy first (140_longlist_admin_policies.sql),
 * since neither future_roles nor future_role_subscriptions ever had one.
 */
test('an admin can expire a future role posting from the Hub-hosted Longlist tab', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup, 15, 'https://deepedge.greyin.net')
  const employerId = await getUserIdByEmail(employer.email)
  const companyId = await getCompanyIdByUserId(employerId)
  const role = await createTestFutureRole(companyId, employerId)
  await employerCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpDeepEdge(adminPage, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  await adminPage.goto('/admin/longlist')
  await expect(adminPage.getByText(role.title)).toBeVisible()

  await adminPage
    .locator(`input[name="future_role_id"][value="${role.id}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Expire' })
    .click()
  await adminPage.waitForURL(/\/admin\/longlist/)
  // The row stays listed (this admin view isn't filtered to open-only),
  // but its "Expire" action disappears once status flips.
  await expect(
    adminPage.locator(`input[name="future_role_id"][value="${role.id}"]`).locator('xpath=..').getByRole('button', { name: 'Expire' })
  ).toHaveCount(0)

  await adminCtx.close()
})
