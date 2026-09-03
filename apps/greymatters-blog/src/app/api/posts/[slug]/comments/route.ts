import { createClient } from '@/app/lib/supabase/server'
import { absoluteUrl } from '@/app/lib/site-url'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const formData = await request.formData()
  const content = (formData.get('content') as string || '').trim()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl(`/login?next=/posts/${slug}`))
  }

  if (!content) {
    return NextResponse.redirect(absoluteUrl(`/posts/${slug}`))
  }

  const { data: post } = await supabase
    .from('posts')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!post) {
    return NextResponse.redirect(absoluteUrl(`/posts/${slug}`))
  }

  await supabase.from('comments').insert({
    post_id: post.id,
    user_id: user.id,
    content,
  })

  return NextResponse.redirect(absoluteUrl(`/posts/${slug}#comments`))
}
