import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Ported from apps/stackworks/src/app/api/admin/asks/delete/route.ts
// (Phase 3, pitch-readiness plan).
export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const askId = formData.get('ask_id') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  await supabase.from('project_asks').delete().eq('id', askId)

  return NextResponse.redirect(absoluteUrl('/admin/stackworks'))
}
