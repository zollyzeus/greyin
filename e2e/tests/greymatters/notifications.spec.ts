import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { createTestPost, getUserIdByEmail } from '../../utils/admin'

test('a post author is notified when someone comments', async ({ browser, cleanup }) => {
  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpGreyMatters(authorPage, cleanup)
  const authorId = await getUserIdByEmail(author.email)
  await login(authorPage, author, '/dashboard')

  const post = await createTestPost({ author_id: authorId, title: `E2E Notification Post ${Date.now()}` })
  cleanup.trackEntity('posts', post.id)

  const commenterCtx = await browser.newContext()
  const commenterPage = await commenterCtx.newPage()
  const commenter = await signUpGreyMatters(commenterPage, cleanup)
  await login(commenterPage, commenter, '/dashboard')
  await commenterPage.goto(`/posts/${post.slug}`)
  await commenterPage.locator('textarea[name="content"]').fill(`E2E notification comment ${Date.now()}`)
  await commenterPage.getByRole('button', { name: 'Post Comment' }).click()
  await expect(commenterPage.getByText('E2E notification comment', { exact: false })).toBeVisible()
  await commenterCtx.close()

  await authorPage.goto('/dashboard')
  await expect(authorPage.getByLabel('Notifications')).toContainText('1')

  await authorPage.goto('/notifications')
  await expect(authorPage.getByText('New comment on your post')).toBeVisible()

  await authorCtx.close()
})
