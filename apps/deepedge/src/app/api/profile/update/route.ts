import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return redirect('/login')
  }

  // Only touch fields this particular form actually submitted, so posting from
  // e.g. the employer settings form doesn't null out full_name/phone/bio/etc.
  const profileUpdate: Record<string, unknown> = {}
  for (const field of ['full_name', 'phone', 'location', 'bio']) {
    if (formData.has(field)) profileUpdate[field] = formData.get(field)
  }

  if (Object.keys(profileUpdate).length > 0) {
    profileUpdate.updated_at = new Date().toISOString()
    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user.id)

    if (profileError) {
      console.error('Profile update error:', profileError)
      return redirect('/profile?error=profile_update_failed')
    }
  }

  // Check if user is employer - update company info
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (company) {
    const { error: companyError } = await supabase
      .from('companies')
      .update({
        name: formData.get('company_name'),
        industry: formData.get('industry'),
        size: formData.get('company_size'),
        description: formData.get('company_description'),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (companyError) {
      console.error('Company update error:', companyError)
    }
  }

  // Check if user is candidate - update candidate info
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (candidate) {
    const skillsString = formData.get('skills') as string
    const skills = skillsString ? skillsString.split(',').map(s => s.trim()).filter(s => s) : []

    const { error: candidateError } = await supabase
      .from('candidates')
      .update({
        current_title: formData.get('current_role'),
        skills: skills,
        experience_years: formData.get('experience_years') ? parseInt(formData.get('experience_years') as string) : null,
        resume_url: (formData.get('resume_url') as string) || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (candidateError) {
      console.error('Candidate update error:', candidateError)
    }
  }

  const redirectTo = (formData.get('redirect_to') as string) || '/profile'
  const separator = redirectTo.includes('?') ? '&' : '?'
  return redirect(`${redirectTo}${separator}success=true`)
}
