import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

const VALID_STATUSES = [
  'submitted', 'reviewing', 'shortlisted', 'interview', 'offer', 'rejected', 'accepted', 'withdrawn',
]

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()
  const status = formData.get('status') as string
  const jobId = formData.get('job_id') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.redirect(absoluteUrl(`/employer/jobs/${jobId}/applications?error=${encodeURIComponent('Not a valid status.')}`))
  }

  // Only the employer who owns the job (via their company) can change its
  // applications' status. applications -> jobs -> companies -> user_id.
  const { data: application } = await supabase
    .from('applications')
    .select('id, jobs ( company_id, companies ( user_id ) )')
    .eq('id', id)
    .single()

  const ownerId = (application?.jobs as any)?.companies?.user_id
  if (!application || ownerId !== user.id) {
    return NextResponse.redirect(absoluteUrl('/employer/dashboard'))
  }

  await supabase
    .from('applications')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.redirect(absoluteUrl(`/employer/jobs/${jobId}/applications?success=1`))
}
