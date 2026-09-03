import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { mockRazorpayCheckout } from '../../utils/razorpay'
import { getUserIdByEmail, grantFreeagentSubscription } from '../../utils/admin'

/**
 * Mocks Razorpay's checkout.js (see utils/razorpay.ts) rather than driving
 * the real hosted widget — this exercises the app's own checkout wiring and
 * its /api/orders/verify signature-verification logic for real, without
 * depending on a third-party iframe's DOM/UI stability.
 */
test('buyer can pay for a gig with a Razorpay test card and reach the order success page', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup)
  // Posting a gig is subscription-gated (093/094) -- granted directly,
  // same "don't drive the real Razorpay Subscriptions checkout UI in
  // e2e" precedent as client-jobs.spec.ts.
  await grantFreeagentSubscription(await getUserIdByEmail(seller.email))
  await login(sellerPage, seller, '/dashboard')

  const gigTitle = `E2E Paid Gig ${Date.now()}`
  await sellerPage.goto('/gigs/new')
  await sellerPage.locator('#title').fill(gigTitle)
  await sellerPage.locator('#description').fill('Gig used to exercise the real Razorpay test-mode checkout.')
  await sellerPage.locator('#price_min').fill('1000')
  await sellerPage.getByRole('button', { name: 'Publish Gig' }).click()
  await sellerPage.waitForURL(/\/gigs\/[^/]+$/)
  const gigId = sellerPage.url().split('/gigs/')[1]
  await sellerCtx.close()

  const buyerCtx = await browser.newContext()
  const page = await buyerCtx.newPage()
  const buyer = await signUpFlexPro(page, 'client', cleanup)
  await login(page, buyer, '/dashboard')

  await mockRazorpayCheckout(page)

  await page.goto(`/checkout/${gigId}`)
  await page.getByRole('button', { name: 'Proceed to Payment' }).click()

  await page.waitForURL(/\/orders\/.+\/success/, { timeout: 30_000 })
  await expect(page.getByText(/success|paid|confirmed/i).first()).toBeVisible()

  await buyerCtx.close()
})
