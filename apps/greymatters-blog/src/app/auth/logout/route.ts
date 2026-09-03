import { createClient } from '@/app/lib/supabase/server'
import { absoluteUrl } from '@/app/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  await supabase.auth.signOut()

  return NextResponse.redirect(absoluteUrl('/login'))
}
