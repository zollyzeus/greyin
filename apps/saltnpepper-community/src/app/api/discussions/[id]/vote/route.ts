import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Real up/down voting (146_discussion_voting.sql) -- RLS has no direct
// write policy on discussion_votes, so vote_discussion() (SECURITY
// DEFINER) is the only legitimate write path; this route is a thin
// pass-through to it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { value } = await request.json().catch(() => ({ value: null }))
  if (![-1, 0, 1].includes(value)) {
    return NextResponse.json({ error: 'Invalid vote value' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('vote_discussion', {
    p_discussion_id: id,
    p_value: value,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ vote_score: data })
}
