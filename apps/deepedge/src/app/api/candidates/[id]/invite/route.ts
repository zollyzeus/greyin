import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// `id` is the candidate's profiles.id, matching every other route on this
// page (search results link by user_id, not candidates.id). job_invites'
// own RLS (149) is the real enforcement -- an employer can only insert a
// row for a job they own -- this route just surfaces a friendly redirect
// either way instead of a bare error page.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const jobId = formData.get('job_id') as string
  if (!jobId) {
    return NextResponse.redirect(absoluteUrl('/candidates?invite_error=' + encodeURIComponent('Choose a job to invite this candidate to.')))
  }

  // consume_credit is the same dormant credit type (096) DeepEdge already
  // seeds per tier but has never enforced -- this is the first real
  // consumption of 'job_invite'.
  const { data: canInvite } = await supabase.rpc('consume_credit', {
    p_user_id: user.id,
    p_product: 'deepedge_hiring',
    p_credit_type: 'job_invite',
  })
  if (!canInvite) {
    return NextResponse.redirect(
      absoluteUrl('/candidates?invite_error=' + encodeURIComponent("You've used all your job invites for this month, or don't have an active plan. Upgrade to invite more."))
    )
  }

  const { error } = await supabase.from('job_invites').insert({
    job_id: jobId,
    candidate_user_id: id,
    invited_by: user.id,
  })

  if (error) {
    // UNIQUE(job_id, candidate_user_id) -- already invited to this job is
    // the expected/common conflict case, not a real failure.
    const alreadyInvited = error.code === '23505'
    return NextResponse.redirect(
      absoluteUrl('/candidates?invite_error=' + encodeURIComponent(alreadyInvited ? "You've already invited this candidate to that job." : 'Could not send the invite. Please try again.'))
    )
  }

  return NextResponse.redirect(absoluteUrl('/candidates?invited=1'))
}
