import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { createPaidOrder, getUserIdByEmail, grantFreeagentSubscription } from '../../utils/admin'

/**
 * Fast-forwards straight to a 'paid' order (via admin helper, since the real
 * Razorpay checkout is already covered by checkout-payment.spec.ts) and then
 * drives the rest of the order lifecycle through the real UI: status
 * updates, buyer/seller chat, delivery, and the review + seller response.
 */
test('order moves through in_progress -> delivered -> completed, with chat and a review along the way', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(seller.email))
  await login(sellerPage, seller, '/dashboard')

  const gigTitle = `E2E Lifecycle Gig ${Date.now()}`
  await sellerPage.goto('/gigs/new')
  await sellerPage.locator('#title').fill(gigTitle)
  await sellerPage.locator('#description').fill('Gig used to exercise the full order lifecycle.')
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
  const order = await createPaidOrder({ gigId, buyerId, sellerId, amount: 1530 })

  await sellerPage.goto(`/orders/${order.id}`)
  await buyerPage.goto(`/orders/${order.id}`)

  // Seller: paid -> in_progress
  await sellerPage.getByRole('button', { name: 'Mark as In Progress' }).click()
  await sellerPage.waitForURL(`/orders/${order.id}`)

  // Chat round-trip.
  const sellerMessage = `Hi, starting work now — ${Date.now()}`
  await sellerPage.getByPlaceholder('Type your message...').fill(sellerMessage)
  await sellerPage.getByRole('button', { name: 'Send' }).click()
  await expect(sellerPage.getByText(sellerMessage)).toBeVisible()

  await buyerPage.reload()
  const buyerMessage = `Thanks, looking forward to it — ${Date.now()}`
  await buyerPage.getByPlaceholder('Type your message...').fill(buyerMessage)
  await buyerPage.getByRole('button', { name: 'Send' }).click()
  await expect(buyerPage.getByText(sellerMessage)).toBeVisible()
  await expect(buyerPage.getByText(buyerMessage)).toBeVisible()

  // Seller: in_progress -> delivered (uploads a deliverable file).
  await sellerPage.reload()
  await sellerPage.setInputFiles('input[name="file"]', {
    name: 'deliverable.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('e2e deliverable contents'),
  })
  await sellerPage.locator('textarea[name="notes"]').fill('Delivered by the e2e suite.')
  await sellerPage.getByRole('button', { name: 'Upload & Mark Delivered' }).click()
  await sellerPage.waitForURL(`/orders/${order.id}`)
  await expect(sellerPage.getByText('Delivered by the e2e suite.')).toBeVisible()

  // Buyer: delivered -> completed.
  await buyerPage.goto(`/orders/${order.id}`)
  await buyerPage.getByRole('button', { name: 'Accept Delivery' }).click()
  await buyerPage.waitForURL(`/orders/${order.id}`)

  // Buyer leaves a 5-star review.
  await buyerPage.getByRole('button', { name: 'Rate 5 stars' }).click()
  const reviewText = `Excellent work, e2e suite approved — ${Date.now()}`
  await buyerPage.getByPlaceholder('Share your experience with this service...').fill(reviewText)
  await buyerPage.getByRole('button', { name: 'Submit Review' }).click()
  await expect(buyerPage.getByText(reviewText)).toBeVisible()

  // Seller responds to the review.
  await sellerPage.goto(`/orders/${order.id}`)
  await expect(sellerPage.getByText(reviewText)).toBeVisible()
  await sellerPage.getByRole('button', { name: 'Respond to Review' }).click()
  const responseText = `Thank you! — ${Date.now()}`
  await sellerPage.getByPlaceholder('Thank the customer and address their feedback...').fill(responseText)
  await sellerPage.getByRole('button', { name: 'Submit Response' }).click()
  await expect(sellerPage.getByText(responseText)).toBeVisible()

  // The review is now public on the gig page.
  await buyerPage.goto(`/gigs/${gigId}`)
  await expect(buyerPage.getByText(reviewText)).toBeVisible()

  await sellerCtx.close()
  await buyerCtx.close()
})
