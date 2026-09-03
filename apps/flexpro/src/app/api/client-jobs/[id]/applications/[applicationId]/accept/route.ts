import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Matches the EXISTING gig-purchase flow's own real precedent, not a
// new number invented for this path: checkout/[id]/page.tsx already
// adds a 2% "Service Fee" to what the buyer pays, and
// api/payouts/request's PLATFORM_FEE_RATE already deducts 2% from
// what the seller nets -- "both sides pay something, smaller each" was
// already the live gig-purchase model, just never named as such (the
// retired "0%-commission" copy was simply wrong about it). Using the
// same 2% here keeps one platform-wide meaning for "service fee"
// rather than two different numbers for the same concept. Deliberately
// charged at acceptance, not at posting, matching 093's "charge at the
// point of actual value" reasoning.
const SERVICE_FEE_RATE = 0.02

export async function POST(request: Request, { params }: { params: Promise<{ id: string; applicationId: string }> }) {
  const { id: jobId, applicationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: job } = await supabase.from('client_jobs').select('id, client_id, status').eq('id', jobId).single()
  if (!job || job.client_id !== user.id || job.status !== 'open') {
    return NextResponse.redirect(absoluteUrl(`/client-jobs/${jobId}`))
  }

  const { data: application } = await supabase
    .from('client_job_applications')
    .select('id, freelancer_id, proposed_price, status')
    .eq('id', applicationId)
    .eq('job_id', jobId)
    .single()
  if (!application || application.status !== 'pending') {
    return NextResponse.redirect(absoluteUrl(`/client-jobs/${jobId}`))
  }

  const serviceFee = Math.round(application.proposed_price * SERVICE_FEE_RATE)

  // RLS's own "Job client can accept or reject an application to their
  // job" policy (093) is the real enforcement on this update; the
  // ownership/status checks above exist for a clean redirect, not as
  // the security boundary.
  const { error: acceptError } = await supabase
    .from('client_job_applications')
    .update({ status: 'accepted' })
    .eq('id', applicationId)

  if (acceptError) {
    return NextResponse.redirect(absoluteUrl(`/client-jobs/${jobId}?error=${encodeURIComponent('Could not accept this application.')}`))
  }

  // Every other pending applicant is auto-rejected -- the job is now
  // spoken for, matching real hiring behavior rather than leaving
  // competing applications stuck pending indefinitely.
  await supabase
    .from('client_job_applications')
    .update({ status: 'rejected' })
    .eq('job_id', jobId)
    .eq('status', 'pending')
    .neq('id', applicationId)

  await supabase.from('client_jobs').update({ status: 'in_progress' }).eq('id', jobId)

  // Pre-claims the gig_orders row (same pattern mentor-session bookings
  // already use, per api/orders/create's own comment) -- amount and
  // both service fees are locked in now, from the accepted
  // application's own proposed_price, before any payment happens.
  const { data: order, error: orderError } = await supabase
    .from('gig_orders')
    .insert({
      buyer_id: user.id,
      seller_id: application.freelancer_id,
      amount: application.proposed_price,
      client_job_application_id: applicationId,
      service_fee_buyer: serviceFee,
      service_fee_seller: serviceFee,
      status: 'pending',
    })
    .select('id')
    .single()

  if (orderError || !order) {
    console.error('Failed to pre-claim order for accepted client job application:', orderError)
    return NextResponse.redirect(absoluteUrl(`/client-jobs/${jobId}?error=${encodeURIComponent('Accepted, but could not start payment. Contact support.')}`))
  }

  return NextResponse.redirect(absoluteUrl(`/client-jobs/${jobId}/pay/${order.id}`))
}
