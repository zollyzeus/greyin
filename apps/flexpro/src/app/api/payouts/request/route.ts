import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

const PLATFORM_FEE_RATE = 0.02

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const amount = Math.round(Number(formData.get('amount')))
  const bankAccountName = (formData.get('bank_account_name') as string || '').trim()
  const bankAccountNumber = (formData.get('bank_account_number') as string || '').trim()
  const bankIfsc = (formData.get('bank_ifsc') as string || '').trim()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  if (!amount || amount <= 0 || !bankAccountName || !bankAccountNumber || !bankIfsc) {
    return NextResponse.redirect(absoluteUrl('/earnings?error=' + encodeURIComponent('All fields are required.')))
  }

  // Recompute the available balance server-side rather than trusting the
  // submitted amount — the client-side max= on the input is a UX hint only.
  const { data: completedOrders } = await supabase
    .from('gig_orders')
    .select('amount')
    .eq('seller_id', user.id)
    .eq('status', 'completed')

  const { data: existingRequests } = await supabase
    .from('payout_requests')
    .select('amount, status')
    .eq('freelancer_id', user.id)

  const totalEarned = (completedOrders || []).reduce((sum, o) => sum + o.amount, 0)
  const netEarned = Math.round(totalEarned * (1 - PLATFORM_FEE_RATE))
  const alreadyClaimed = (existingRequests || [])
    .filter((p) => p.status !== 'rejected')
    .reduce((sum, p) => sum + p.amount, 0)
  const available = Math.max(0, netEarned - alreadyClaimed)

  if (amount > available) {
    return NextResponse.redirect(
      absoluteUrl('/earnings?error=' + encodeURIComponent('Requested amount exceeds your available balance.'))
    )
  }

  const { error } = await supabase.from('payout_requests').insert({
    freelancer_id: user.id,
    amount,
    bank_account_name: bankAccountName,
    bank_account_number: bankAccountNumber,
    bank_ifsc: bankIfsc,
  })

  if (error) {
    console.error('Payout request failed:', error)
    return NextResponse.redirect(
      absoluteUrl('/earnings?error=' + encodeURIComponent('Could not submit withdrawal request. Please try again.'))
    )
  }

  return NextResponse.redirect(absoluteUrl('/earnings?success=1'))
}
