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

  // RLS ("Candidates can remove their own references") already scopes
  // this to rows the current user owns.
  await supabase.from('professional_references').delete().eq('id', id)

  return NextResponse.redirect(absoluteUrl('/profile'))
}
