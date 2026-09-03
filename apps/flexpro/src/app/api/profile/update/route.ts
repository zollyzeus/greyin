import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return redirect('/login')
  }

  const skillsString = formData.get('skills') as string
  const skills = skillsString ? skillsString.split(',').map(s => s.trim()).filter(s => s) : []

  const languagesString = formData.get('languages') as string
  const languages = languagesString ? languagesString.split(',').map(s => s.trim()).filter(s => s) : []

  // Update profile
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: formData.get('full_name'),
      phone: formData.get('phone'),
      location: formData.get('location'),
      title: formData.get('title'),
      bio: formData.get('bio'),
      skills: skills,
      languages: languages,
      razorpay_account_id: formData.get('razorpay_account_id'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('Profile update error:', error)
    return redirect('/profile?error=update_failed')
  }

  return redirect('/profile?success=true')
}
