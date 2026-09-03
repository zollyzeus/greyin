import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'
import { isRazorpayXConfigured, sendPayout } from '@/lib/razorpayx'

const VALID_STATUSES = ['pending', 'processing', 'paid', 'rejected']

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const payoutId = formData.get('payout_id') as string
  const status = formData.get('status') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.redirect(absoluteUrl('/admin'))
  }

  // Marking a request "paid" triggers a real bank transfer when RazorpayX
  // is configured; otherwise this falls back to today's behavior (an admin
  // has already wired the money manually and is just recording that here).
  if (status === 'paid' && isRazorpayXConfigured()) {
    const { data: payout } = await supabase
      .from('payout_requests')
      .select('amount, bank_account_name, bank_account_number, bank_ifsc, freelancer_id')
      .eq('id', payoutId)
      .single()

    if (!payout) {
      return NextResponse.redirect(absoluteUrl('/admin'))
    }

    const { data: freelancer } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', payout.freelancer_id)
      .single()

    const result = await sendPayout({
      freelancerName: freelancer?.full_name || payout.bank_account_name,
      freelancerEmail: freelancer?.email || '',
      bankAccountName: payout.bank_account_name,
      bankAccountNumber: payout.bank_account_number,
      bankIfsc: payout.bank_ifsc,
      amountInRupees: payout.amount,
      reference: payoutId,
    })

    if (!result.success) {
      await supabase
        .from('payout_requests')
        .update({ failure_reason: result.error, razorpayx_fund_account_id: result.fundAccountId })
        .eq('id', payoutId)
      return NextResponse.redirect(
        absoluteUrl('/admin?error=' + encodeURIComponent(`RazorpayX payout failed: ${result.error}`))
      )
    }

    await supabase
      .from('payout_requests')
      .update({
        status: 'paid',
        processed_at: new Date().toISOString(),
        processed_by: user.id,
        payout_method: 'razorpayx',
        razorpayx_payout_id: result.payoutId,
        razorpayx_fund_account_id: result.fundAccountId,
        failure_reason: null,
      })
      .eq('id', payoutId)

    return NextResponse.redirect(absoluteUrl('/admin'))
  }

  await supabase
    .from('payout_requests')
    .update({ status, processed_at: new Date().toISOString(), processed_by: user.id })
    .eq('id', payoutId)

  return NextResponse.redirect(absoluteUrl('/admin'))
}
