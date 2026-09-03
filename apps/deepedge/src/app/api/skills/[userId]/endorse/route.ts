import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId: endorseeId } = await params
  const supabase = await createClient()
  const formData = await request.formData()
  const skill = formData.get('skill') as string

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { error } = await supabase
    .from('skill_endorsements')
    .insert({ endorser_id: user.id, endorsee_id: endorseeId, skill })

  // 23505 = unique_violation -- already endorsed, treat as idempotent success.
  if (error && error.code !== '23505') {
    console.error('Failed to endorse skill:', error)
    return NextResponse.redirect(
      absoluteUrl(`/candidates/${endorseeId}?error=` + encodeURIComponent('Endorsing requires a real collaboration with this person.'))
    )
  }

  return NextResponse.redirect(absoluteUrl(`/candidates/${endorseeId}`))
}
