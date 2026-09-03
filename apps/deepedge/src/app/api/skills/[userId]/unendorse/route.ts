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

  await supabase
    .from('skill_endorsements')
    .delete()
    .eq('endorser_id', user.id)
    .eq('endorsee_id', endorseeId)
    .eq('skill', skill)

  return NextResponse.redirect(absoluteUrl(`/candidates/${endorseeId}`))
}
