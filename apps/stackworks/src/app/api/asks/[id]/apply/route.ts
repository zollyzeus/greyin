import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=/asks/${id}`))
  }

  const pitch = (formData.get('pitch') as string || '').trim()
  if (!pitch) {
    return NextResponse.redirect(absoluteUrl(`/asks/${id}`))
  }

  // No Builder/Supporter distinction here by design -- anyone authenticated
  // may apply to an ask (an existing Builder can reasonably want to help on
  // another Builder's project too).
  await supabase
    .from('project_applications')
    .insert({
      ask_id: id,
      applicant_id: user.id,
      pitch,
    })

  return NextResponse.redirect(absoluteUrl(`/asks/${id}`))
}
