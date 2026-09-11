import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { createTestPost, deleteTestPost } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function getLikeCount(postId: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=like_count`, { headers: restHeaders() })
  const rows = await res.json()
  return rows[0]?.like_count ?? 0
}

/**
 * Lightweight one-shot "like" toggle (139_post_reactions.sql) -- mirrors
 * StackWorks' project_upvotes trigger-maintained-counter pattern exactly.
 */
test('liking and unliking a post toggles the trigger-maintained like_count', async ({ page, cleanup }) => {
  const testPost = await createTestPost()

  const reader = await signUpGreyMatters(page, cleanup)
  await login(page, reader, '/dashboard')
  await page.goto(`/posts/${testPost.slug}`)

  const likeButton = page.getByRole('button', { name: /0 likes/i })
  await expect(likeButton).toBeVisible()

  // The button updates optimistically before the request resolves (see
  // PostLikeButton.tsx), so wait for the real network response -- not
  // just the UI text -- before asserting on the database row it caused.
  const [likeResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes(`/api/posts/${testPost.slug}/like`) && res.request().method() === 'POST'),
    likeButton.click(),
  ])
  expect(likeResponse.ok()).toBeTruthy()
  await expect(page.getByRole('button', { name: /1 like\b/i })).toBeVisible()
  expect(await getLikeCount(testPost.id)).toBe(1)

  // Toggling again (unlike) brings it back to zero -- not a repeatable
  // multi-click counter.
  const [unlikeResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes(`/api/posts/${testPost.slug}/like`) && res.request().method() === 'DELETE'),
    page.getByRole('button', { name: /1 like\b/i }).click(),
  ])
  expect(unlikeResponse.ok()).toBeTruthy()
  await expect(page.getByRole('button', { name: /0 likes/i })).toBeVisible()
  expect(await getLikeCount(testPost.id)).toBe(0)

  await deleteTestPost(testPost.id)
})

test('a logged-out visitor sees the like count but clicking sends them to log in', async ({ page }) => {
  const testPost = await createTestPost()

  await page.goto(`/posts/${testPost.slug}`)
  const likeButton = page.getByRole('button', { name: /0 likes/i })
  await expect(likeButton).toBeVisible()

  await likeButton.click()
  await page.waitForURL(/\/login/)

  expect(await getLikeCount(testPost.id)).toBe(0)
  await deleteTestPost(testPost.id)
})
