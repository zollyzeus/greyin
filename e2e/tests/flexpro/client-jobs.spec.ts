import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { getClientJobIdByTitle, grantFreeagentSubscription, getUserIdByEmail, getGigOrderRow } from '../../utils/admin'
import { mockRazorpayCheckout } from '../../utils/razorpay'

/**
 * User-directed feature: the reverse direction FlexPro never had --
 * an expert posts a JOB (need) instead of only a gig LISTING, other
 * members apply for free, the poster accepts one and pays. Retires the
 * "0%-commission" claim (093's own header comment) in favor of a real
 * model: one subscription gates posting either kind of listing
 * (gig-as-freelancer or job-as-client), a 2% service fee applies to
 * both sides on an accepted transaction -- matching the EXISTING
 * gig-purchase flow's own real fee shape (checkout's buyer-side fee +
 * payouts' seller-side deduction), not a new number invented for this
 * path.
 *
 * Subscription itself is granted directly (grantFreeagentSubscription)
 * rather than driving the real Razorpay Subscriptions checkout UI --
 * same established precedent as deepedge's own enterprise
 * subscriptions (no test-mode mock exists for that API, unlike
 * one-time Orders). The job-payment step below IS a one-time Order
 * under the hood (api/client-jobs/.../accept pre-claims a gig_orders
 * row, api/orders/create attaches a real Razorpay order to it) so
 * mockRazorpayCheckout applies directly, unmodified.
 */
test('posting is gated on a subscription; applying is free; accepting creates a real order with the fee split on both sides', async ({ browser, cleanup }) => {
  const clientCtx = await browser.newContext()
  const clientPage = await clientCtx.newPage()
  const client = await signUpFlexPro(clientPage, 'client', cleanup)
  const clientId = await getUserIdByEmail(client.email)

  const freelancerCtx = await browser.newContext()
  const freelancerPage = await freelancerCtx.newPage()
  const freelancer = await signUpFlexPro(freelancerPage, 'freelancer', cleanup)

  // --- Without a subscription, posting a job redirects to /subscribe ---
  await login(clientPage, client, '/dashboard')
  await clientPage.goto('/client-jobs/new')
  await expect(clientPage.getByText('requires an active FlexPro Pro subscription')).toBeVisible()

  await grantFreeagentSubscription(clientId)

  // --- With an active subscription, posting works ---
  const jobTitle = `E2E Client Job ${Date.now()}`
  await clientPage.goto('/client-jobs/new')
  await clientPage.locator('#title').fill(jobTitle)
  await clientPage.locator('#description').fill('A real job posted by the e2e suite to exercise the client-jobs flow.')
  await clientPage.locator('#budget_amount').fill('10000')
  await clientPage.getByRole('button', { name: 'Post job' }).click()
  await clientPage.waitForURL(/\/client-jobs\/[0-9a-f-]+$/)

  const jobId = await getClientJobIdByTitle(jobTitle)

  // --- Freelancer applies -- free, no subscription required ---
  await login(freelancerPage, freelancer, '/dashboard')
  await freelancerPage.goto(`/client-jobs/${jobId}`)
  await freelancerPage.locator('#proposed_price').fill('9000')
  await freelancerPage.locator('#cover_note').fill('I can do this well.')
  await freelancerPage.getByRole('button', { name: 'Submit application' }).click()
  await freelancerPage.waitForURL(/applied=1/)

  // Must be registered before any navigation to a page carrying the
  // checkout.js <script> tag -- the tag is present in /pay's initial
  // HTML and the browser requests it immediately on navigation, before
  // a post-navigation call could ever intercept it (mockRazorpayCheckout's
  // own docstring: "before the page action that triggers new Razorpay(...)",
  // which in practice means before the navigation that lands on that page).
  await mockRazorpayCheckout(clientPage)

  // --- Client accepts -- redirects to payment ---
  await clientPage.goto(`/client-jobs/${jobId}`)
  await clientPage.getByRole('button', { name: 'Accept' }).click()
  await clientPage.waitForURL(/\/client-jobs\/.+\/pay\/.+/)

  await expect(clientPage.getByText('₹9,000')).toBeVisible()
  await expect(clientPage.getByText('₹180')).toBeVisible() // 2% of 9000
  await expect(clientPage.getByText('₹9,180')).toBeVisible() // total

  await clientPage.getByRole('button', { name: 'Proceed to Payment' }).click()
  await clientPage.waitForURL(/\/orders\/.+\/success/, { timeout: 15000 })

  const orderId = clientPage.url().match(/\/orders\/([0-9a-f-]+)\/success/)?.[1]
  expect(orderId).toBeTruthy()

  // --- Verify the real stored row directly, not just what the UI showed ---
  const order = await getGigOrderRow(orderId!)
  expect(order?.status).toBe('paid')
  expect(order?.payment_status).toBe('captured')
  expect(order?.gig_id).toBeNull()
  expect(order?.client_job_application_id).toBeTruthy()
  expect(order?.amount).toBe(9000)
  expect(order?.service_fee_buyer).toBe(180)
  expect(order?.service_fee_seller).toBe(180)
})
