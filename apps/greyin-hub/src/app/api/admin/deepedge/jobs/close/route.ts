import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Ported from apps/deepedge/src/app/api/admin/jobs/close/route.ts
// (Phase 3, pitch-readiness plan) -- same body, redirects back to the
// Hub-hosted tab instead of DeepEdge's own /admin.
export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const jobId = formData.get('job_id') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  // RLS's "Admins can update any job" policy is the actual authorization
  // boundary here; the role check above is just so a non-admin gets a clean
  // redirect instead of a silent 0-row no-op.
  await supabase.from('jobs').update({ status: 'closed' }).eq('id', jobId)

  return NextResponse.redirect(absoluteUrl('/admin/deepedge'))
}
