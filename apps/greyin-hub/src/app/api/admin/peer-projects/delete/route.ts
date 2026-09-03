import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// RLS's own "Admins can delete any peer project" policy (089) is what
// actually enforces this -- the profile-role check here is UX (redirect
// a non-admin before they even see the button), not the real gate.
// Deleting the project cascades to its members and ratings (ON DELETE
// CASCADE), which is the intended moderation action: removing a flagged
// project removes the reciprocal-rating pair along with it, rather than
// needing a separate ratings-only delete path.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/admin/peer-projects'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  const formData = await request.formData()
  const projectId = (formData.get('project_id') as string || '').trim()
  if (projectId) {
    await supabase.from('peer_projects').delete().eq('id', projectId)
  }

  return NextResponse.redirect(absoluteUrl('/admin/peer-projects'))
}
