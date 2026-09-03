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

  // RLS (project_asks UPDATE policy) already restricts this to the ask's
  // creator, so no extra ownership check is needed here -- an update from
  // a non-owner would just silently affect zero rows.
  await supabase
    .from('project_asks')
    .update({ status: 'closed' })
    .eq('id', id)

  return NextResponse.redirect(absoluteUrl(`/asks/${id}`))
}
