import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  const formData = await request.formData()
  const provider = formData.get('provider') as string
  const label = (formData.get('label') as string || '').trim()
  const model = (formData.get('model') as string || '').trim()
  const apiKey = (formData.get('api_key') as string || '').trim() || null
  const baseUrl = (formData.get('base_url') as string || '').trim() || null
  const priority = parseInt(formData.get('priority') as string, 10) || 0

  if (!['anthropic', 'openai', 'ollama'].includes(provider) || !label || !model) {
    return NextResponse.redirect(absoluteUrl('/admin/llm'))
  }

  await supabase.from('llm_providers').insert({
    provider,
    label,
    model,
    api_key: apiKey,
    base_url: baseUrl,
    priority,
  })

  return NextResponse.redirect(absoluteUrl('/admin/llm'))
}
