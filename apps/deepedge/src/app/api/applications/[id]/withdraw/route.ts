import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Emergent gap audit item #2: applications.status already had a
// 'withdrawn' value (and the UI already styled it), but no route ever
// set it. RLS's own "Candidates can withdraw their own application"
// policy (092) is the real enforcement -- it only permits this exact
// transition, on the candidate's own row, nothing else -- this route
// is a thin wrapper, not a second authorization check.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  await supabase.from('applications').update({ status: 'withdrawn' }).eq('id', id)

  return NextResponse.redirect(absoluteUrl('/dashboard/applications'))
}
