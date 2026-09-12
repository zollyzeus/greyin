import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// resolve_content_report() (152) is the real enforcement (admin-only,
// checked inside the function) -- this route just forwards the form
// and redirects back to the queue either way.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const formData = await request.formData()
  const reportId = formData.get('report_id') as string
  const status = formData.get('status') as string

  await supabase.rpc('resolve_content_report', {
    p_report_id: reportId,
    p_status: status,
  })

  return NextResponse.redirect(absoluteUrl('/admin/reports'))
}
