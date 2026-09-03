import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Free to apply -- no subscription check, matching 093's "supply is
// gated, demand isn't" design. RLS's own "Any authenticated user can
// apply to an open job" policy is the real enforcement (including the
// job-must-still-be-open check); this route is a thin wrapper.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=/client-jobs/${id}`))
  }

  const formData = await request.formData()
  const coverNote = (formData.get('cover_note') as string || '').trim()
  const proposedPrice = parseInt((formData.get('proposed_price') as string) || '', 10)
  if (!proposedPrice || proposedPrice <= 0) {
    return NextResponse.redirect(absoluteUrl(`/client-jobs/${id}?error=${encodeURIComponent('Enter a valid proposed price.')}`))
  }

  const { error } = await supabase.from('client_job_applications').insert({
    job_id: id,
    freelancer_id: user.id,
    cover_note: coverNote || null,
    proposed_price: proposedPrice,
  })

  if (error) {
    return NextResponse.redirect(
      absoluteUrl(`/client-jobs/${id}?error=${encodeURIComponent('Could not submit your application. It may already be closed.')}`)
    )
  }

  return NextResponse.redirect(absoluteUrl(`/client-jobs/${id}?applied=1`))
}
