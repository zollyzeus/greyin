import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!company) {
    return NextResponse.redirect(
      absoluteUrl('/employer/post-job?error=' + encodeURIComponent('Set up your company profile first.'))
    )
  }

  const title = formData.get('title') as string
  const skillsRaw = formData.get('skills_required') as string
  const skills = skillsRaw ? skillsRaw.split(',').map((s) => s.trim()).filter(Boolean) : []
  const feedVisibilityRaw = formData.get('feed_visibility') as string
  const feedVisibility = ['public', 'followers', 'private'].includes(feedVisibilityRaw) ? feedVisibilityRaw : 'public'

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      company_id: company.id,
      title,
      slug: `${slugify(title)}-${Math.random().toString(36).slice(2, 8)}`,
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
      status: 'open',
      open_to_career_changers: formData.get('open_to_career_changers') === 'on',
      open_to_reentry: formData.get('open_to_reentry') === 'on',
      feed_visibility: feedVisibility,
    })
    .select('id')
    .single()

  if (error || !job) {
    return NextResponse.redirect(
      absoluteUrl('/employer/post-job?error=' + encodeURIComponent('Could not create the job. Please try again.'))
    )
  }

  return NextResponse.redirect(absoluteUrl('/employer/dashboard'))
}
