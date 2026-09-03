import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  // RLS ("Candidates manage their own employment history") enforces
  // this is the caller's own row -- no separate ownership check needed.
  await supabase.from('candidate_employment_history').delete().eq('id', id)

  return NextResponse.redirect(absoluteUrl('/profile'))
}
