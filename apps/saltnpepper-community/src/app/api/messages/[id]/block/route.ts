import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Blocks the OTHER participant in this conversation (152) -- looked up
// server-side from the conversation, not client-supplied, so a caller
// can't block an arbitrary user id via this route.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', id)

  const other = (participants || []).find((p) => p.user_id !== user.id)
  if (!other) {
    return NextResponse.redirect(absoluteUrl('/messages'))
  }

  await supabase.rpc('block_user', { p_user_id: other.user_id })

  return NextResponse.redirect(absoluteUrl('/messages?blocked=1'))
}
