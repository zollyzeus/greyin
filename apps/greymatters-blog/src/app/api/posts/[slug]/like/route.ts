import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

// Toggle a like on/off -- direct insert/delete into post_likes
// (139_post_reactions.sql), RLS already scopes both to auth.uid()=user_id
// so no extra ownership check is needed here. Keyed on the post's slug,
// like every other route under api/posts/[slug]/ -- resolved to the
// real post id (what post_likes.post_id actually references) first.
async function resolvePostId(supabase: Awaited<ReturnType<typeof createClient>>, slug: string) {
  const { data: post } = await supabase.from('posts').select('id').eq('slug', slug).single()
  return post?.id as string | undefined
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const postId = await resolvePostId(supabase, slug)
  if (!postId) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ liked: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const postId = await resolvePostId(supabase, slug)
  if (!postId) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ liked: false })
}
