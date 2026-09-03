import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=/projects/${id}`))
  }

  const { data: existing } = await supabase
    .from('project_upvotes')
    .select('project_id')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('project_upvotes').delete().eq('project_id', id).eq('user_id', user.id)
  } else {
    await supabase.from('project_upvotes').insert({ project_id: id, user_id: user.id })
  }

  return NextResponse.redirect(absoluteUrl(`/projects/${id}`))
}
