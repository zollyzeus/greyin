import { createClient } from '@/lib/supabase/server'
import { getJobPostSuggestions } from '@/lib/job-post-assist'
import { NextResponse } from 'next/server'

// Deliberately separate from api/jobs/create -- must never consume a
// posting credit. A "see suggestions before I publish" click is free
// and repeatable; the real publish action is untouched.
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

  const suggestions = await getJobPostSuggestions(String(title).slice(0, 200), String(description).slice(0, 4000))
  if (!suggestions) {
    return NextResponse.json({ error: 'AI suggestions are unavailable right now. Try again shortly.' }, { status: 503 })
  }

  return NextResponse.json({ suggestions })
}
