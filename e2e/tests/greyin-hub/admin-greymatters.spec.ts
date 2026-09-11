import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin, createTestPost } from '../../utils/admin'

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

async function createTestComment(postId: string, userId: string): Promise<{ id: string; content: string }> {
  const content = `E2E Hub-Admin Comment ${Date.now()}`
  const res = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ post_id: postId, user_id: userId, content, status: 'approved' }),
  })
  if (!res.ok) throw new Error(`Failed to create test comment: ${res.status} ${await res.text()}`)
  const [row] = await res.json()
  return { id: row.id, content: row.content }
}

async function getPostStatus(postId: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=status`, { headers: restHeaders() })
  const [row] = await res.json()
  return row?.status
}

/**
 * Ported GreyMatters admin tab on Hub (Phase 3, pitch-readiness plan) --
 * post unpublish and comment deletion ported fully ("Send weekly
 * digest"/"AI Quality Sweep" deliberately not ported, see
 * admin/greymatters/page.tsx's own header comment).
 */
test('an admin can unpublish a post and delete a comment from the Hub-hosted GreyMatters tab', async ({ browser, cleanup }) => {
  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpGreyMatters(authorPage, cleanup)
  const authorId = await getUserIdByEmail(author.email)
  await authorCtx.close()

  const post = await createTestPost({ author_id: authorId, title: `E2E Hub-Admin Post ${Date.now()}` })
  const comment = await createTestComment(post.id, authorId)

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpGreyMatters(adminPage, cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  await adminPage.goto('/admin/greymatters')
  await expect(adminPage.getByText(comment.content)).toBeVisible()

  await adminPage
    .locator(`input[name="post_id"][value="${post.id}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Unpublish' })
    .click()
  await adminPage.waitForURL(/\/admin\/greymatters/)
  expect(await getPostStatus(post.id)).toBe('archived')

  adminPage.once('dialog', (d) => d.accept())
  await adminPage
    .locator(`input[name="comment_id"][value="${comment.id}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Delete' })
    .click()
  await adminPage.waitForURL(/\/admin\/greymatters/)
  await expect(adminPage.getByText(comment.content)).not.toBeVisible()

  await adminCtx.close()
})
