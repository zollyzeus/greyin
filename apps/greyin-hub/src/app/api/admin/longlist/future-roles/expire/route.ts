import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// New (Phase 3, pitch-readiness plan) -- Longlist had no admin moderation
// action at all before this. RLS's new "Admins manage all future roles"
// policy (140) is the real authorization boundary; the role check below
// just gives a non-admin a clean redirect instead of a silent 0-row no-op.
export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const futureRoleId = formData.get('future_role_id') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  await supabase.from('future_roles').update({ status: 'expired' }).eq('id', futureRoleId)

  return NextResponse.redirect(absoluteUrl('/admin/longlist'))
}
