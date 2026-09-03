import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const decision = formData.get('decision') === 'accepted' ? 'accepted' : 'declined'

  const { data: application } = await supabase
    .from('project_applications')
    .select('ask_id')
    .eq('id', id)
    .single()

  // RLS (project_applications UPDATE policy) already restricts this to the
  // ask's project owner, so no extra ownership check is needed -- an
  // update from anyone else would silently affect zero rows.
  await supabase
    .from('project_applications')
    .update({ status: decision })
    .eq('id', id)

  return NextResponse.redirect(
    absoluteUrl(application ? `/asks/${application.ask_id}` : '/dashboard')
  )
}
