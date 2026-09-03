import crypto from 'crypto'
import 'dotenv/config'
import { test, expect } from '../../utils/fixtures'
import { signUpFlexPro, login } from '../../utils/auth'
import { createPendingOrderWithRazorpayId, getGigOrderStatus, getUserIdByEmail, grantFreeagentSubscription } from '../../utils/admin'

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!

/**
 * checkout-payment.spec.ts covers the buyer-facing checkout.js -> /api/orders/verify
 * path. Razorpay can also mark an order paid via a server-to-server webhook
 * independent of that flow (e.g. UPI/netbanking completing after the buyer
 * leaves the page) — this covers /api/webhooks/razorpay directly with a
 * correctly HMAC-signed payment.captured event, without going through the
 * browser at all.
 */
test('a payment.captured webhook marks the order paid', async ({ page, browser, request, cleanup }) => {
  const sellerCtx = await browser.newContext()
  const sellerPage = await sellerCtx.newPage()
  const seller = await signUpFlexPro(sellerPage, 'freelancer', cleanup)
  await grantFreeagentSubscription(await getUserIdByEmail(seller.email))
  await login(sellerPage, seller, '/dashboard')

  const gigTitle = `E2E Webhook Gig ${Date.now()}`
  await sellerPage.goto('/gigs/new')
  await sellerPage.locator('#title').fill(gigTitle)
  await sellerPage.locator('#description').fill('Gig used to exercise the payment.captured webhook.')
  await sellerPage.locator('#price_min').fill('900')
  await sellerPage.getByRole('button', { name: 'Publish Gig' }).click()
  await sellerPage.waitForURL(/\/gigs\/[^/]+$/)
  const gigId = sellerPage.url().split('/gigs/')[1]
  await sellerCtx.close()

  // Buyer only needs to exist (to own the seeded order) — deliberately not
  // logged in on `page`, and the webhook call below uses the standalone
  // `request` fixture (no cookies at all), matching how Razorpay's real
  // servers call this route: with zero user session. Using an
  // already-authenticated page's request context here would let the
  // buyer's own RLS grant ("auth.uid() = buyer_id") mask a route that
  // can't actually update anything when called the way Razorpay really
  // calls it — that's exactly the gap this test exists to catch.
  const buyer = await signUpFlexPro(page, 'client', cleanup)

  const [sellerId, buyerId] = await Promise.all([
    getUserIdByEmail(seller.email),
    getUserIdByEmail(buyer.email),
  ])
  const razorpayOrderId = 'order_e2e_' + Math.random().toString(36).slice(2)
  const order = await createPendingOrderWithRazorpayId({
    gigId,
    buyerId,
    sellerId,
    amount: 900,
    razorpayOrderId,
  })
  expect(await getGigOrderStatus(order.id)).toBe('pending')

  const paymentId = 'pay_e2e_' + Math.random().toString(36).slice(2)
  const event = {
    event: 'payment.captured',
    event_id: `evt_e2e_${Date.now()}`,
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: razorpayOrderId,
        },
      },
    },
  }
  const rawBody = JSON.stringify(event)
  const signature = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex')

  const res = await request.post('/api/webhooks/razorpay', {
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
    },
    data: rawBody,
  })
  expect(res.ok()).toBe(true)

  expect(await getGigOrderStatus(order.id)).toBe('paid')
})

test('a payment.captured webhook with a bad signature is rejected', async ({ request }) => {
  const event = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_x', order_id: 'order_x' } } } }
  const res = await request.post('/api/webhooks/razorpay', {
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': 'deliberately-invalid-signature',
    },
    data: JSON.stringify(event),
  })
  expect(res.status()).toBe(400)
})
