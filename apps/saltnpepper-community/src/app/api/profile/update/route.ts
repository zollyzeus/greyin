import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return redirect('/login')
  }

  const interestsString = formData.get('interests') as string
  const interests = interestsString ? interestsString.split(',').map(s => s.trim()).filter(s => s) : []

  // Update profile
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: formData.get('full_name'),
      bio: formData.get('bio'),
      location: formData.get('location'),
      interests: interests,
      website: formData.get('website'),
      linkedin: formData.get('linkedin'),
      twitter: formData.get('twitter'),
      email_notifications: formData.get('email_notifications') === 'on',
      comment_notifications: formData.get('comment_notifications') === 'on',
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('Profile update error:', error)
    return redirect('/profile?error=update_failed')
  }

  return redirect('/profile?success=true')
}
