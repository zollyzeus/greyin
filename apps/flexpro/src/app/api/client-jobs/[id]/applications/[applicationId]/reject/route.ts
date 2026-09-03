import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string; applicationId: string }> }) {
  const { id: jobId, applicationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  await supabase.from('client_job_applications').update({ status: 'rejected' }).eq('id', applicationId).eq('job_id', jobId)

  return NextResponse.redirect(absoluteUrl(`/client-jobs/${jobId}`))
}
