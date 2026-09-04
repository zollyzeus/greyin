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
      // FIXED (integrity audit 2026-09-04): 'linkedin'/'twitter' aren't
      // real profiles columns -- 'linkedin_url'/'twitter_handle' are.
      // 'interests' now has a real column too (114) -- confirmed unread
      // anywhere else on the platform yet, added as a real field on the
      // strength of its own plausible future value (a directory
      // filter/shared-interest match), not because anything needs it today.
      linkedin_url: formData.get('linkedin'),
      twitter_handle: formData.get('twitter'),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('Profile update error:', error)
    return redirect('/profile?error=update_failed')
  }

  return redirect('/profile?success=true')
}
