import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { createCompletedOrder, getUserIdByEmail, grantFreeagentSubscription } from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

/**
 * FlexPro's AI delivery-quality score is additive/informational only
 * (does not feed greyin_score, unlike GreyMatters' post score) -- it's
 * triggered right when the buyer submits their review, since
 * order_reviews can only be inserted once the order is already
 * 'completed' (RLS), so a review is the one point the delivery content
 * and the buyer's own feedback both exist together. Score is
 * non-deterministic (a real local model), so only the pattern is
 * asserted, not an exact number.
 */
test('a buyer leaving a review triggers an AI delivery-quality score visible on the order and the seller\'s profile', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(seller.email))
  await login(sellerPage, seller, '/dashboard')

  const gigTitle = `E2E AI Quality Gig ${Date.now()}`
  await sellerPage.goto('/gigs/new')
  await sellerPage.locator('#title').fill(gigTitle)
  await sellerPage.locator('#description').fill('Gig used to exercise the AI delivery-quality pipeline.')
  await sellerPage.locator('#price_min').fill('1500')
  await sellerPage.getByRole('button', { name: 'Publish Gig' }).click()
  await sellerPage.waitForURL(/\/gigs\/[^/]+$/)
  const gigId = sellerPage.url().split('/gigs/')[1]

  const buyerCtx = await browser.newContext()
  const buyerPage = await buyerCtx.newPage()
  const buyer = await signUpFlexPro(buyerPage, 'client', cleanup)
  await login(buyerPage, buyer, '/dashboard')

  const [sellerId, buyerId] = await Promise.all([
    getUserIdByEmail(seller.email),
    getUserIdByEmail(buyer.email),
  ])
  const order = await createCompletedOrder({ gigId, buyerId, sellerId, amount: 1500 })

  await buyerPage.goto(`/orders/${order.id}`)
  // This is the buyer's first real click after signup, with nothing in
  // between to burn off GuidedTour's ~600ms auto-start delay -- without
  // this it intermittently races the tour's full-viewport overlay,
  // which swallows the click (see e2e/utils/tour.ts).
  await dismissGuidedTourIfShown(buyerPage)
  await buyerPage.getByRole('button', { name: 'Rate 5 stars' }).click()
  const reviewText = `Delivered exactly what was asked, clean and well-documented — ${Date.now()}`
  await buyerPage.getByPlaceholder('Share your experience with this service...').fill(reviewText)
  // Explicitly wait for the POST itself to resolve -- the review AND its
  // AI delivery-quality score (048_ai_quality_scores.sql) are both
  // written server-side inside this one request, awaited before it
  // returns, so this is the real completion signal. Asserting on the
  // reviewText appearing client-side isn't reliable here: it can match
  // the textarea's own just-typed value before the request finishes,
  // which raced ahead of the AI scoring in earlier runs of this test.
  await Promise.all([
    buyerPage.waitForResponse((res) => res.url().includes(`/api/orders/${order.id}/review`) && res.request().method() === 'POST'),
    buyerPage.getByRole('button', { name: 'Submit Review' }).click(),
  ])
  await expect(buyerPage.getByText(reviewText)).toBeVisible()

  await buyerPage.reload()
  await expect(buyerPage.getByText(/AI delivery review: \d+\/100/)).toBeVisible({ timeout: 30_000 })

  await sellerPage.goto('/profile')
  await expect(sellerPage.getByText(/\d+ scored deliver(y|ies) · avg \d+\/100/)).toBeVisible()
})
