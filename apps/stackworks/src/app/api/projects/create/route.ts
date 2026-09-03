import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { isBuilder } from '@/lib/stackworks-role'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/projects/new'))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('years_experience, stackworks_role')
    .eq('id', user.id)
    .single()

  if (!profile || !isBuilder(profile)) {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  const title = (formData.get('title') as string || '').trim()
  const description = (formData.get('description') as string || '').trim()
  if (!title || !description) {
    return NextResponse.redirect(absoluteUrl('/projects/new'))
  }

  const techStackRaw = formData.get('tech_stack') as string
  const techStack = techStackRaw ? techStackRaw.split(',').map((s) => s.trim()).filter(Boolean) : []
  const images = formData.getAll('images').map((v) => v as string).filter(Boolean)

  const { data: project } = await supabase
    .from('builder_projects')
    .insert({
      user_id: user.id,
      title,
      description,
      tech_stack: techStack,
      images,
      github_url: (formData.get('github_url') as string) || null,
      demo_url: (formData.get('demo_url') as string) || null,
      status: (formData.get('status') as string) || 'idea',
    })
    .select('id')
    .single()

  return NextResponse.redirect(
    absoluteUrl(project ? `/projects/${project.id}` : '/projects')
  )
}
