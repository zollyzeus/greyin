import { createClient } from '@/app/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST(request: Request) {
  const supabase = await createClient()
  const formData = await request.formData()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return redirect('/login')
  }

  // Update profile
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: formData.get('full_name'),
      bio: formData.get('bio'),
      website: formData.get('website'),
      twitter: formData.get('twitter'),
      location: formData.get('location'),
      email_notifications: formData.get('email_notifications') === 'on',
      show_email: formData.get('show_email') === 'on',
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('Profile update error:', error)
    return redirect('/profile?error=update_failed')
  }

  return redirect('/profile?success=true')
}
