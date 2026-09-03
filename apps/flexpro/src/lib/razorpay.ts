// Refunds against the main Razorpay Payment Gateway account (the one
// checkout already uses) — distinct from lib/razorpayx.ts, which is the
// separate RazorpayX Payouts product used for freelancer withdrawals.
// Escrow cancellations/disputes refund the *buyer's original payment*, so
// they go through this API instead.

const BASE_URL = 'https://api.razorpay.com/v1'

function authHeader() {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env
  return 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')
}

interface RefundResult {
  success: boolean
  refundId?: string
  error?: string
}

export async function refundPayment(razorpayPaymentId: string, amountInRupees: number, reference: string): Promise<RefundResult> {
  try {
    const res = await fetch(`${BASE_URL}/payments/${razorpayPaymentId}/refund`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amountInRupees * 100),
        speed: 'normal',
        notes: { reference },
      }),
    })
    const body = await res.json()
    if (!res.ok) {
      return { success: false, error: body?.error?.description || 'Failed to process refund' }
    }
    return { success: true, refundId: body.id }
  } catch (error) {
    console.error('Razorpay refund error:', error)
    return { success: false, error: 'Unexpected error contacting Razorpay' }
  }
}
