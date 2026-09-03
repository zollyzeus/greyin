import type { Page } from '@playwright/test'
import 'dotenv/config'

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!

/**
 * Replaces Razorpay's real hosted checkout.js with a stub that skips the
 * actual iframe/UI entirely and calls the app's own `handler` callback with
 * a synthesized payment response — same shape a real successful checkout
 * would produce (`razorpay_payment_id`, `razorpay_order_id`,
 * `razorpay_signature`).
 *
 * Driving the real widget (published test card, "Contact details" step,
 * etc.) tests Razorpay's own hosted UI, which we don't control and which
 * has shown genuine cross-run non-determinism (see git history on this
 * file). What actually matters for our coverage is the app's checkout
 * wiring and its own /api/.../verify route, which does real HMAC-SHA256
 * signature verification against RAZORPAY_KEY_SECRET — this mock produces
 * a *correctly signed* payload using that same secret, so it still
 * exercises real, meaningful verification logic on the backend, just
 * without depending on Razorpay's UI being reachable/stable.
 *
 * Must be called (awaited) before the page action that triggers
 * `new Razorpay(...)` — e.g. before clicking "Proceed to Payment" / "Tip".
 */
export async function mockRazorpayCheckout(page: Page): Promise<void> {
  await page.route('https://checkout.razorpay.com/v1/checkout.js', (route) => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.Razorpay = function (options) {
          return {
            open: async function () {
              const paymentId = 'pay_e2e_' + Math.random().toString(36).slice(2)
              const orderId = options.order_id
              const enc = new TextEncoder()
              const key = await crypto.subtle.importKey(
                'raw',
                enc.encode(${JSON.stringify(RAZORPAY_KEY_SECRET)}),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
              )
              const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(orderId + '|' + paymentId))
              const signature = Array.from(new Uint8Array(sigBuf))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('')
              options.handler({
                razorpay_payment_id: paymentId,
                razorpay_order_id: orderId,
                razorpay_signature: signature,
              })
            },
            on: function () {},
          }
        }
      `,
    })
  })
}
