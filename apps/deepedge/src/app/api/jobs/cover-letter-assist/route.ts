import { createClient } from '@/lib/supabase/server'
import { draftCoverLetter } from '@/lib/cover-letter-assist'
import { NextResponse } from 'next/server'

// Deliberately separate from api/applications/create -- this must never
// gate or consume anything real. A "let me see a draft" click has to be
// free and repeatable; the actual application submission is untouched.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const jobTitle = String(body?.jobTitle || '').slice(0, 200)
  const jobDescription = String(body?.jobDescription || '').slice(0, 4000)
  const companyName = body?.companyName ? String(body.companyName).slice(0, 200) : null
  if (!jobTitle || !jobDescription) {
    return NextResponse.json({ error: 'Job title and description are required' }, { status: 400 })
  }

  const { data: candidate } = await supabase
    .from('candidates')
    .select('current_title, skills, experience_years')
    .eq('user_id', user.id)
    .maybeSingle()

  const draft = await draftCoverLetter(
    {
      current_title: candidate?.current_title ?? null,
      skills: candidate?.skills ?? [],
      experience_years: candidate?.experience_years ?? null,
    },
    { title: jobTitle, description: jobDescription, companyName }
  )

  if (!draft) {
    return NextResponse.json({ error: 'AI suggestions are unavailable right now. Try again shortly.' }, { status: 503 })
  }

  return NextResponse.json({ draft })
}
