import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { createPaidOrder, getUserIdByEmail, grantFreeagentSubscription, promoteToAdmin } from '../../utils/admin'

/**
 * Covers the Upwork-style escrow dispute ladder added this round:
 * request-revision, cancel+refund, and admin-mediated dispute resolution.
 * checkout-payment.spec.ts / order-lifecycle.spec.ts already cover the
 * happy path (pay -> in_progress -> delivered -> completed), so these seed
 * straight into the relevant status via the admin helper rather than
 * repeating that whole flow three times.
 */

test('a buyer can request a revision, and the freelancer re-delivering completes the order', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(seller.email))
  await login(sellerPage, seller, '/dashboard')

  const gigTitle = `E2E Revision Gig ${Date.now()}`
  await sellerPage.goto('/gigs/new')
  await sellerPage.locator('#title').fill(gigTitle)
  await sellerPage.locator('#description').fill('Gig used to exercise the revision-request path.')
  await sellerPage.locator('#price_min').fill('1200')
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
  const order = await createPaidOrder({ gigId, buyerId, sellerId, amount: 1224 })

  await sellerPage.goto(`/orders/${order.id}`)
  await sellerPage.getByRole('button', { name: 'Mark as In Progress' }).click()
  await sellerPage.waitForURL(`/orders/${order.id}`)
  await sellerPage.setInputFiles('input[name="file"]', {
    name: 'v1.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('first draft'),
  })
  await sellerPage.getByRole('button', { name: 'Upload & Mark Delivered' }).click()
  await sellerPage.waitForURL(`/orders/${order.id}`)

  // Buyer rejects the delivery instead of accepting it — escrow must stay
  // held (status must NOT become 'completed', so it can't show up in the
  // freelancer's earnings balance yet).
  await buyerPage.goto(`/orders/${order.id}`)
  await buyerPage.locator('summary', { hasText: 'Request changes' }).click()
  const revisionNote = `Please add more detail — e2e ${Date.now()}`
  await buyerPage.locator('textarea[name="notes"]').fill(revisionNote)
  await buyerPage.getByRole('button', { name: 'Send back for revision' }).click()
  await buyerPage.waitForURL(`/orders/${order.id}`)
  await expect(buyerPage.getByText('Revision Requested')).toBeVisible()

  // Freelancer sees the feedback and re-delivers.
  await sellerPage.goto(`/orders/${order.id}`)
  await expect(sellerPage.getByText(revisionNote)).toBeVisible()
  await sellerPage.setInputFiles('input[name="file"]', {
    name: 'v2.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('addressed feedback'),
  })
  await sellerPage.getByRole('button', { name: 'Upload & Mark Delivered' }).click()
  await sellerPage.waitForURL(`/orders/${order.id}`)

  await buyerPage.goto(`/orders/${order.id}`)
  await buyerPage.getByRole('button', { name: 'Accept Delivery' }).click()
  await buyerPage.waitForURL(`/orders/${order.id}`)
  await expect(buyerPage.getByText('Completed', { exact: true })).toBeVisible()

  await sellerPage.goto('/earnings')
  await expect(sellerPage.locator('#available-balance')).toHaveText('₹1,200')

  await sellerCtx.close()
  await buyerCtx.close()
})

test('a buyer can cancel and get refunded before the freelancer starts work', async ({ page, browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const sellerUser = await signUpFlexPro(sellerPage, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(sellerUser.email))
  await login(sellerPage, sellerUser, '/dashboard')

  const gigTitle = `E2E Cancel Gig ${Date.now()}`
  await sellerPage.goto('/gigs/new')
  await sellerPage.locator('#title').fill(gigTitle)
  await sellerPage.locator('#description').fill('Gig used to exercise buyer cancellation.')
  await sellerPage.locator('#price_min').fill('900')
  await sellerPage.getByRole('button', { name: 'Publish Gig' }).click()
  await sellerPage.waitForURL(/\/gigs\/[^/]+$/)
  const gigId = sellerPage.url().split('/gigs/')[1]

  const buyer = await signUpFlexPro(page, 'client', cleanup)
  await login(page, buyer, '/dashboard')

  const [sellerId, buyerId] = await Promise.all([
    getUserIdByEmail(sellerUser.email),
    getUserIdByEmail(buyer.email),
  ])
  // No razorpay_payment_id on this seeded order, so /api/orders/cancel takes
  // its no-payment-on-record branch (plain status change, no refund API
  // call) — the real refund call against a captured payment is exercised
  // implicitly by checkout-payment.spec.ts's real Razorpay order.
  const order = await createPaidOrder({ gigId, buyerId, sellerId, amount: 918 })

  await page.goto(`/orders/${order.id}`)
  await page.getByText('Cancel this order').click()
  await page.getByRole('button', { name: 'Cancel & refund' }).click()
  await page.waitForURL(`/orders/${order.id}`)
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible()

  await sellerCtx.close()
})

test('an admin resolves a dispute by releasing escrow to the freelancer', async ({ browser, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(seller.email))
  await login(sellerPage, seller, '/dashboard')

  const gigTitle = `E2E Dispute Gig ${Date.now()}`
  await sellerPage.goto('/gigs/new')
  await sellerPage.locator('#title').fill(gigTitle)
  await sellerPage.locator('#description').fill('Gig used to exercise dispute resolution.')
  await sellerPage.locator('#price_min').fill('1100')
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
  const order = await createPaidOrder({ gigId, buyerId, sellerId, amount: 1122 })

  await sellerPage.goto(`/orders/${order.id}`)
  await sellerPage.getByRole('button', { name: 'Mark as In Progress' }).click()
  await sellerPage.waitForURL(`/orders/${order.id}`)
  await sellerPage.setInputFiles('input[name="file"]', {
    name: 'final.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('final deliverable'),
  })
  await sellerPage.getByRole('button', { name: 'Upload & Mark Delivered' }).click()
  await sellerPage.waitForURL(`/orders/${order.id}`)

  await buyerPage.goto(`/orders/${order.id}`)
  await buyerPage.locator('summary', { hasText: 'Raise a dispute' }).click()
  const disputeReason = `Not what was agreed — e2e ${Date.now()}`
  await buyerPage.locator('textarea[name="reason"]').fill(disputeReason)
  await buyerPage.getByRole('button', { name: 'Escalate to admin' }).click()
  await buyerPage.waitForURL(`/orders/${order.id}`)
  await expect(buyerPage.getByText('Disputed', { exact: false })).toBeVisible()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpFlexPro(adminPage, 'client', cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, '/dashboard')

  await adminPage.goto('/admin')
  await expect(adminPage.getByText(disputeReason)).toBeVisible()
  await adminPage.getByRole('button', { name: 'Release to freelancer' }).click()
  await adminPage.waitForURL(/\/admin/)

  await sellerPage.goto('/earnings')
  await expect(sellerPage.locator('#available-balance')).toHaveText('₹1,100')

  await sellerCtx.close()
  await buyerCtx.close()
  await adminCtx.close()
})
