import { createClient } from '@/lib/supabase/server'
import { getGigListingSuggestions } from '@/lib/gig-quality'
import { NextResponse } from 'next/server'

// Deliberately separate from api/gigs/create -- this must NEVER call
// consume_credit(). A "let me see suggestions before I publish" click has
// to be free and repeatable; api/gigs/create is the one place a posting
// credit is actually spent, on the real publish action.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, description } = await request.json().catch(() => ({}))
  if (!title || !description) {
    return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
  }

  const result = await getGigListingSuggestions(String(title).slice(0, 200), String(description).slice(0, 4000))
  if (!result) {
    return NextResponse.json({ error: 'AI suggestions are unavailable right now. Try again shortly.' }, { status: 503 })
  }

  return NextResponse.json({ suggestions: result.suggestions })
}
