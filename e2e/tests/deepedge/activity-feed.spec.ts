import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, createTestFollow, deleteTestFollow } from '../../utils/admin'

/**
 * Replicated activity-feed smoke test (see the Salt & Pepper reference:
 * e2e/tests/saltnpepper/activity-feed.spec.ts), exercising the
 * trickiest resolution in the activity_feed view (053_activity_feed.sql):
 * jobs has no direct owner column at all -- the feed's author_id for a
 * job resolves through jobs.company_id -> companies.user_id. deepedge
 * has no in-app Follow button yet (deferred for v1, its only user-listing
 * page is subscription-gated), so the follow relationship is seeded
 * directly rather than clicked through the UI -- this test's job is to
 * prove the view's join and the /feed page's rendering, not the follow
 * click path (already covered elsewhere).
 */
test('a followed employer\'s new job appears in the follower\'s /feed via the jobs-to-companies join', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `E2E Feed Job ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Visible to followers.')
  await employerPage.locator('#location').fill('Remote')
  await employerPage.locator('select[name="feed_visibility"]').selectOption('public')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')

  const employerId = await getUserIdByEmail(employer.email)

  const followerCtx = await browser.newContext()
  const followerPage = await followerCtx.newPage()
  const follower = await signUpDeepEdge(followerPage, 'candidate', cleanup)
  await login(followerPage, follower, '/dashboard')
  const followerId = await getUserIdByEmail(follower.email)

  await createTestFollow(followerId, employerId)

  await followerPage.goto('/feed')
  await expect(followerPage.getByText(jobTitle)).toBeVisible()

  await deleteTestFollow(followerId, employerId)
  await employerCtx.close()
  await followerCtx.close()
})
