import { test, expect } from '../../utils/fixtures'
import { getUserIdByEmail, grantFreeagentSubscription } from '../../utils/admin'
import { signUpFlexPro, login } from '../../utils/auth'

/**
 * Replicated activity-feed smoke test (see the Salt & Pepper reference:
 * e2e/tests/saltnpepper/activity-feed.spec.ts) exercising FlexPro's
 * own headline content type, gigs, whose owner column is freelancer_id
 * (not author_id) -- confirms the activity_feed view's column-name
 * normalization (053_activity_feed.sql) works for this table too, and
 * exercises the new /sellers/[id] page built to fix a pre-existing dead
 * "View Profile" link.
 */
test('a follower sees a followed freelancer\'s public gig in /feed but not their private one', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(seller.email))
  await login(sellerPage, seller, '/dashboard')

  const publicTitle = `E2E Feed Public Gig ${Date.now()}`
  await sellerPage.goto('/gigs/new')
  await sellerPage.locator('#title').fill(publicTitle)
  await sellerPage.locator('#description').fill('Visible to followers.')
  await sellerPage.locator('#price_min').fill('1000')
  await sellerPage.locator('select[name="feed_visibility"]').selectOption('public')
  await sellerPage.getByRole('button', { name: 'Publish Gig' }).click()
  await sellerPage.waitForURL(/\/gigs\/[^/]+$/)
  const publicGigUrl = sellerPage.url()

  const privateTitle = `E2E Feed Private Gig ${Date.now()}`
  await sellerPage.goto('/gigs/new')
  await sellerPage.locator('#title').fill(privateTitle)
  await sellerPage.locator('#description').fill('Not distributed to followers.')
  await sellerPage.locator('#price_min').fill('1000')
  await sellerPage.locator('select[name="feed_visibility"]').selectOption('private')
  await sellerPage.getByRole('button', { name: 'Publish Gig' }).click()
  await sellerPage.waitForURL(/\/gigs\/[^/]+$/)

  const followerCtx = await browser.newContext()
  const followerPage = await followerCtx.newPage()
  const follower = await signUpFlexPro(followerPage, 'client', cleanup)
  await login(followerPage, follower, '/dashboard')

  await followerPage.goto(publicGigUrl)
  await followerPage.getByRole('button', { name: 'Follow' }).click()
  await expect(followerPage.getByRole('button', { name: 'Unfollow' })).toBeVisible()

  await followerPage.goto('/feed')
  await expect(followerPage.getByText(publicTitle)).toBeVisible()
  await expect(followerPage.getByText(privateTitle)).not.toBeVisible()

  await sellerCtx.close()
  await followerCtx.close()
})
