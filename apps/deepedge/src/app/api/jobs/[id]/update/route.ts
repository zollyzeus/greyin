import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: job } = await supabase
    .from('jobs')
    .select('id, companies ( user_id )')
    .eq('id', id)
    .single()

  if (!job || (job.companies as any)?.user_id !== user.id) {
    return NextResponse.redirect(absoluteUrl('/employer/dashboard'))
  }

  const skillsRaw = formData.get('skills_required') as string
  const skills = skillsRaw ? skillsRaw.split(',').map((s) => s.trim()).filter(Boolean) : []

  await supabase
    .from('jobs')
    .update({
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      location: (formData.get('location') as string) || null,
      remote_type: (formData.get('remote_type') as string) || 'hybrid',
      employment_type: (formData.get('employment_type') as string) || 'full-time',
      category: (formData.get('category') as string) || null,
      salary_min: formData.get('salary_min') ? parseInt(formData.get('salary_min') as string, 10) : null,
      salary_max: formData.get('salary_max') ? parseInt(formData.get('salary_max') as string, 10) : null,
      salary_disclosed: formData.get('salary_disclosed') === 'true',
      experience_min: formData.get('experience_min') ? parseInt(formData.get('experience_min') as string, 10) : null,
      experience_max: formData.get('experience_max') ? parseInt(formData.get('experience_max') as string, 10) : null,
      skills_required: skills,
      status: (formData.get('status') as string) || 'open',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  return NextResponse.redirect(absoluteUrl('/employer/dashboard'))
}
