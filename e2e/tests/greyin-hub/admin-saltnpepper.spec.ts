import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

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

async function createTestDiscussion(authorId: string): Promise<{ id: string; title: string }> {
  const title = `E2E Hub-Admin Discussion ${Date.now()}`
  const res = await fetch(`${SUPABASE_URL}/rest/v1/discussions`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ author_id: authorId, title, body: 'Seeded by the Playwright e2e suite.' }),
  })
  if (!res.ok) throw new Error(`Failed to create test discussion: ${res.status} ${await res.text()}`)
  const [row] = await res.json()
  return { id: row.id, title: row.title }
}

/**
 * Ported Salt & Pepper admin tab on Hub (Phase 3, pitch-readiness plan)
 * -- discussion deletion and user-role-update ported fully (the "AI
 * Quality Sweep" action is deliberately not ported, see
 * admin/saltnpepper/page.tsx's own header comment).
 */
test('an admin can delete a discussion from the Hub-hosted Salt & Pepper tab', async ({ browser, cleanup }) => {
  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpSaltNPepper(authorPage, cleanup, 'https://saltnpepper.greyin.net')
  const authorId = await getUserIdByEmail(author.email)
  const discussion = await createTestDiscussion(authorId)
  await authorCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpSaltNPepper(adminPage, cleanup, 'https://saltnpepper.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  await adminPage.goto('/admin/saltnpepper')
  await expect(adminPage.getByText(discussion.title)).toBeVisible()

  adminPage.once('dialog', (d) => d.accept())
  await adminPage
    .locator(`input[name="discussion_id"][value="${discussion.id}"]`)
    .first()
    .locator('xpath=..')
    .getByRole('button', { name: 'Delete' })
    .click()
  await adminPage.waitForURL(/\/admin\/saltnpepper/)
  await expect(adminPage.getByText(discussion.title)).not.toBeVisible()

  await adminCtx.close()
})

test('an admin can update a user role from the Hub-hosted Salt & Pepper tab', async ({ browser, cleanup }) => {
  const targetCtx = await browser.newContext()
  const targetPage = await targetCtx.newPage()
  const target = await signUpSaltNPepper(targetPage, cleanup, 'https://saltnpepper.greyin.net')
  const targetId = await getUserIdByEmail(target.email)
  await targetCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpSaltNPepper(adminPage, cleanup, 'https://saltnpepper.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  await adminPage.goto('/admin/saltnpepper')
  await adminPage
    .locator(`input[name="user_id"][value="${targetId}"]`)
    .locator('xpath=..')
    .locator('select[name="role"]')
    .selectOption('admin')
  await adminPage
    .locator(`input[name="user_id"][value="${targetId}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Update' })
    .click()
  await adminPage.waitForURL(/\/admin\/saltnpepper/)
  await adminCtx.close()

  const verifyCtx = await browser.newContext()
  const verifyPage = await verifyCtx.newPage()
  await login(verifyPage, target, 'https://greyin.net/dashboard', 'https://greyin.net')
  await verifyPage.goto('/admin/saltnpepper')
  await expect(verifyPage).toHaveURL(/\/admin\/saltnpepper/)
  await verifyCtx.close()
})
