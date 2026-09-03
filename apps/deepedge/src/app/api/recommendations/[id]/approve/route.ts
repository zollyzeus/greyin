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

  // RLS ("Recommendees can approve or dismiss their own recommendations")
  // enforces this is addressed to the caller; the immutable-fields
  // trigger enforces this can only change `status`, never the body.
  await supabase.from('written_recommendations').update({ status: 'approved' }).eq('id', id)

  return NextResponse.redirect(absoluteUrl('/profile'))
}
