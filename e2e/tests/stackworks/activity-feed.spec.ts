import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, signUpStackWorksSupporter, login } from '../../utils/auth'

/**
 * Replicated activity-feed smoke test (see the Salt & Pepper reference:
 * e2e/tests/saltnpepper/activity-feed.spec.ts) exercising StackWorks's
 * own headline content type, project_updates, including the
 * jobs/project_updates-style borrowed-title convention
 * ('Update on <project title>') from the activity_feed view
 * (053_activity_feed.sql).
 */
test('a follower sees a followed Builder\'s public project update in /feed but not their private one', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup)
  await login(builderPage, builder, '/dashboard')

  const projectTitle = `E2E Feed Project ${Date.now()}`
  await builderPage.goto('/projects/new')
  await builderPage.locator('#title').fill(projectTitle)
  await builderPage.locator('#description').fill('A project used to exercise the activity feed.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)
  const projectUrl = builderPage.url()

  await builderPage.locator('textarea[name="body"]').fill('Public devlog update.')
  await builderPage.locator('select[name="feed_visibility"]').selectOption('public')
  await builderPage.getByRole('button', { name: 'Post Update' }).click()
  await builderPage.waitForURL(projectUrl)

  await builderPage.locator('textarea[name="body"]').fill('Private devlog update.')
  await builderPage.locator('select[name="feed_visibility"]').selectOption('private')
  await builderPage.getByRole('button', { name: 'Post Update' }).click()
  await builderPage.waitForURL(projectUrl)

  const followerCtx = await browser.newContext()
  const followerPage = await followerCtx.newPage()
  const follower = await signUpStackWorksSupporter(followerPage, cleanup)
  await login(followerPage, follower, '/dashboard')

  await followerPage.goto(projectUrl)
  await followerPage.getByRole('button', { name: 'Follow' }).click()
  await expect(followerPage.getByRole('button', { name: 'Unfollow' })).toBeVisible()

  await followerPage.goto('/feed')
  await expect(followerPage.getByText(`Update on ${projectTitle}`)).toBeVisible()

  // Both the public and private update render the same borrowed title
  // ("Update on <project>") -- distinguish by description snippet
  // instead of title, since the feed card's title alone can't tell them
  // apart.
  await expect(followerPage.getByText('Public devlog update.')).toBeVisible()
  await expect(followerPage.getByText('Private devlog update.')).not.toBeVisible()

  await builderCtx.close()
  await followerCtx.close()
})
