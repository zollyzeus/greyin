import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Ported from apps/flexpro/src/app/api/admin/gigs/close/route.ts
// (Phase 3, pitch-readiness plan).
export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  const gigId = formData.get('gig_id') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  await supabase.from('gigs').update({ status: 'closed' }).eq('id', gigId)

  return NextResponse.redirect(absoluteUrl('/admin/flexpro'))
}
