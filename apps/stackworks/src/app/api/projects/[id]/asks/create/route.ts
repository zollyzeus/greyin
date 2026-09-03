import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { isBuilder } from '@/lib/stackworks-role'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=/projects/${id}/asks/new`))
  }

  const { data: project } = await supabase
    .from('builder_projects')
    .select('id, user_id')
    .eq('id', id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('years_experience, stackworks_role')
    .eq('id', user.id)
    .single()

  if (!project || project.user_id !== user.id || !profile || !isBuilder(profile)) {
    return NextResponse.redirect(absoluteUrl(`/projects/${id}`))
  }

  const roleTitle = (formData.get('role_title') as string || '').trim()
  if (!roleTitle) {
    return NextResponse.redirect(absoluteUrl(`/projects/${id}/asks/new`))
  }

  const skillsRaw = formData.get('skills') as string
  const skills = skillsRaw ? skillsRaw.split(',').map((s) => s.trim()).filter(Boolean) : []

  const { data: ask } = await supabase
    .from('project_asks')
    .insert({
      project_id: id,
      created_by: user.id,
      role_title: roleTitle,
      skills,
      description: (formData.get('description') as string) || null,
      verification_criteria: (formData.get('verification_criteria') as string || '').trim() || null,
    })
    .select('id')
    .single()

  return NextResponse.redirect(
    absoluteUrl(ask ? `/asks/${ask.id}` : `/projects/${id}`)
  )
}
