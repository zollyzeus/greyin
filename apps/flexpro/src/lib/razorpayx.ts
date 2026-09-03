// RazorpayX Payouts — a separate product from the Razorpay Payment Gateway
// already used for checkout, requiring its own account, KYC, and API keys
// (RAZORPAYX_KEY_ID / RAZORPAYX_KEY_SECRET / RAZORPAYX_ACCOUNT_NUMBER) that
// don't exist yet. isRazorpayXConfigured() lets callers fall back to the
// existing manual admin-marks-paid flow when they're unset, exactly like
// the SMTP/Resend fallback in lib/email.ts.

const BASE_URL = 'https://api.razorpay.com/v1'

function authHeader() {
  const { RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET } = process.env
  return 'Basic ' + Buffer.from(`${RAZORPAYX_KEY_ID}:${RAZORPAYX_KEY_SECRET}`).toString('base64')
}

export function isRazorpayXConfigured(): boolean {
  return !!(process.env.RAZORPAYX_KEY_ID && process.env.RAZORPAYX_KEY_SECRET && process.env.RAZORPAYX_ACCOUNT_NUMBER)
}

interface PayoutResult {
  success: boolean
  payoutId?: string
  fundAccountId?: string
  error?: string
}

/**
 * Creates a RazorpayX contact + bank fund account + payout in one call.
 * Each freelancer withdrawal request supplies fresh bank details, so this
 * doesn't try to cache/reuse contacts across requests — simpler and safer
 * than tracking whether previously-entered bank details are still current.
 */
export async function sendPayout(opts: {
  freelancerName: string
  freelancerEmail: string
  bankAccountName: string
  bankAccountNumber: string
  bankIfsc: string
  amountInRupees: number
  reference: string
}): Promise<PayoutResult> {
  try {
    const contactRes = await fetch(`${BASE_URL}/contacts`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: opts.freelancerName,
        email: opts.freelancerEmail,
        type: 'vendor',
        reference_id: opts.reference,
      }),
    })
    const contact = await contactRes.json()
    if (!contactRes.ok) {
      return { success: false, error: contact?.error?.description || 'Failed to create payout contact' }
    }

    const fundAccountRes = await fetch(`${BASE_URL}/fund_accounts`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: contact.id,
        account_type: 'bank_account',
        bank_account: {
          name: opts.bankAccountName,
          ifsc: opts.bankIfsc,
          account_number: opts.bankAccountNumber,
        },
      }),
    })
    const fundAccount = await fundAccountRes.json()
    if (!fundAccountRes.ok) {
      return { success: false, error: fundAccount?.error?.description || 'Failed to create fund account' }
    }

    const payoutRes = await fetch(`${BASE_URL}/payouts`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
        fund_account_id: fundAccount.id,
        amount: Math.round(opts.amountInRupees * 100),
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: opts.reference,
        narration: 'FlexPro freelancer withdrawal',
      }),
    })
    const payout = await payoutRes.json()
    if (!payoutRes.ok) {
      return { success: false, fundAccountId: fundAccount.id, error: payout?.error?.description || 'Failed to create payout' }
    }

    return { success: true, payoutId: payout.id, fundAccountId: fundAccount.id }
  } catch (error) {
    console.error('RazorpayX payout error:', error)
    return { success: false, error: 'Unexpected error contacting RazorpayX' }
  }
}
