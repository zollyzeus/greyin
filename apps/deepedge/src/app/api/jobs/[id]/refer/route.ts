import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { sendReferralInviteEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=/jobs/${jobId}`))
  }

  const formData = await request.formData()
  const referredEmail = ((formData.get('referred_email') as string) || '').trim().toLowerCase()
  const note = ((formData.get('note') as string) || '').trim() || undefined

  if (!referredEmail) {
    return NextResponse.redirect(
      absoluteUrl(`/jobs/${jobId}?referError=${encodeURIComponent('Please enter an email address.')}`)
    )
  }

  const [{ data: job }, { data: referrerProfile }] = await Promise.all([
    supabase.from('jobs').select('id, title').eq('id', jobId).single(),
    supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
  ])

  if (!job) {
    return NextResponse.redirect(absoluteUrl('/jobs'))
  }

  const referrerName = referrerProfile?.full_name || referrerProfile?.email || 'A Greyin member'
  const jobUrl = absoluteUrl(`/jobs/${job.id}`).toString()

  // profiles' SELECT policy is unconditional ("USING (true)") -- looking
  // up an existing account by email here doesn't open anything that isn't
  // already true of every other query against this table in the app.
  const { data: referredProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', referredEmail)
    .maybeSingle()

  if (referredProfile) {
    // SEC-024 (2026-08-26 security audit): job_title and referrer_name
    // are no longer passed here at all -- create_job_referral_notification
    // (077) now derives both itself from the caller's own profile and the
    // real job row, so a direct RPC call bypassing this route can no
    // longer put arbitrary attacker-controlled text in someone else's
    // notification inbox.
    const { error } = await supabase.rpc('create_job_referral_notification', {
      p_recipient_id: referredProfile.id,
      p_job_id: job.id,
    })
    if (error) {
      console.error('Referral notification failed:', error)
      return NextResponse.redirect(
        absoluteUrl(`/jobs/${jobId}?referError=${encodeURIComponent('Could not send the referral. Please try again.')}`)
      )
    }
  } else {
    await sendReferralInviteEmail({
      referredEmail,
      referrerName,
      jobTitle: job.title,
      jobUrl,
      note,
    })
  }

  return NextResponse.redirect(absoluteUrl(`/jobs/${jobId}?referred=1`))
}
