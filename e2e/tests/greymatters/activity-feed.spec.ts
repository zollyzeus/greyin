import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { getPostIdBySlug } from '../../utils/admin'

/**
 * Replicated activity-feed smoke test (see the Salt & Pepper reference:
 * e2e/tests/saltnpepper/activity-feed.spec.ts) exercising GreyMatters'
 * own headline content type, posts. posts.author_id references
 * auth.users, not profiles, directly -- confirms the follow graph
 * (which is keyed on profiles.id, the same underlying uuid) still
 * resolves correctly through the activity_feed view (053_activity_feed.sql).
 */
test('a follower sees a followed author\'s public post in /feed but not their private one', async ({ browser, cleanup }) => {
  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpGreyMatters(authorPage, cleanup)
  await login(authorPage, author, '/dashboard')

  const publicTitle = `E2E Feed Public Post ${Date.now()}`
  await authorPage.goto('/posts/new')
  await authorPage.locator('#title').fill(publicTitle)
  await authorPage.locator('#excerpt').fill('Visible to followers.')
  await authorPage.locator('#content').fill('Public post body.')
  await authorPage.locator('#status').selectOption('published')
  await authorPage.locator('select[name="feed_visibility"]').selectOption('public')
  await authorPage.getByRole('button', { name: 'Save Post' }).click()
  await authorPage.waitForURL('/posts')
  // posts.author_id is ON DELETE SET NULL, not CASCADE (cleanup.ts's own
  // documented exception) -- deleting the test author would silently
  // orphan this row instead of removing it, so it must be tracked
  // explicitly, same as every other GreyMatters spec that creates a post.
  const publicSlug = (await authorPage.locator('div.p-6', { hasText: publicTitle }).getByRole('link', { name: 'Edit' }).getAttribute('href'))!.split('/posts/')[1].replace('/edit', '')
  cleanup.trackEntity('posts', await getPostIdBySlug(publicSlug))

  const privateTitle = `E2E Feed Private Post ${Date.now()}`
  await authorPage.goto('/posts/new')
  await authorPage.locator('#title').fill(privateTitle)
  await authorPage.locator('#excerpt').fill('Not distributed to followers.')
  await authorPage.locator('#content').fill('Private post body.')
  await authorPage.locator('#status').selectOption('published')
  await authorPage.locator('select[name="feed_visibility"]').selectOption('private')
  await authorPage.getByRole('button', { name: 'Save Post' }).click()
  await authorPage.waitForURL('/posts')
  const privateSlug = (await authorPage.locator('div.p-6', { hasText: privateTitle }).getByRole('link', { name: 'Edit' }).getAttribute('href'))!.split('/posts/')[1].replace('/edit', '')
  cleanup.trackEntity('posts', await getPostIdBySlug(privateSlug))

  const followerCtx = await browser.newContext()
  const followerPage = await followerCtx.newPage()
  const follower = await signUpGreyMatters(followerPage, cleanup)
  await login(followerPage, follower, '/dashboard')

  // /posts is the author's OWN post list, not a public listing -- the
  // homepage is where published posts are publicly browsable.
  await followerPage.goto('/')
  await followerPage.getByText(publicTitle).click()
  await followerPage.getByRole('button', { name: 'Follow' }).click()
  await expect(followerPage.getByRole('button', { name: 'Unfollow' })).toBeVisible()

  await followerPage.goto('/feed')
  await expect(followerPage.getByText(publicTitle)).toBeVisible()
  await expect(followerPage.getByText(privateTitle)).not.toBeVisible()

  await authorCtx.close()
  await followerCtx.close()
})
