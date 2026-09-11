import { createClient } from '@/app/lib/supabase/server'
import { createServiceClient } from '@/app/lib/supabase/service'
import { absoluteUrl } from '@/app/lib/site-url'
import { runPostQualityCheck } from '@/app/lib/post-quality'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const formData = await request.formData()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const title = (formData.get('title') as string || '').trim()
  const excerpt = (formData.get('excerpt') as string || '').trim() || null
  const content = (formData.get('content') as string || '').trim()
  const categoryId = (formData.get('category_id') as string) || null
  const status = (formData.get('status') as string) || 'draft'
  const coverImageUrl = (formData.get('cover_image_url') as string || '').trim() || null
  const viewAudienceRaw = formData.get('view_audience') as string
  const viewAudience = ['public', 'follower', 'verified_expert'].includes(viewAudienceRaw) ? viewAudienceRaw : 'public'
  const commentAudienceRaw = formData.get('comment_audience') as string
  const commentAudience = ['public', 'follower', 'verified_expert'].includes(commentAudienceRaw) ? commentAudienceRaw : 'public'
  const tags = Array.from(new Set(
    ((formData.get('tags') as string) || '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  ))

  const { data: existing } = await supabase.from('posts').select('id, status, published_at, views_count, tags').eq('slug', slug).single()

  if (!title || !content || !existing) {
    return NextResponse.redirect(absoluteUrl('/posts'))
  }

  const { error } = await supabase
    .from('posts')
    .update({
      title,
      excerpt,
      content,
      category_id: categoryId,
      cover_image_url: coverImageUrl,
      status,
      published_at: status === 'published' && !existing.published_at ? new Date().toISOString() : undefined,
      view_audience: viewAudience,
      comment_audience: commentAudience,
      tags,
    })
    .eq('slug', slug)
    // RLS (author_id = auth.uid()) already enforces this, but scoping the
    // query too means a mismatched owner gets a clean 0-row no-op instead of
    // relying solely on the database to reject it.
    .eq('author_id', user.id)

  if (error) {
    console.error('Post update failed:', error)
    return NextResponse.redirect(absoluteUrl(`/posts/${slug}/edit?error=` + encodeURIComponent('Could not save changes.')))
  }

  // Rescore on every published save, not just once -- unlike a
  // StackWorks verification outcome, a post's content can genuinely
  // change after publish, and this score both displays on the post/
  // profile AND feeds greyin_scores' greymatters_score (048), so a
  // stale score would be actively misleading in both places.
  if (status === 'published') {
    const { data: commentRows } = await supabase
      .from('comments')
      .select('content')
      .eq('post_id', existing.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(5)

    const quality = await runPostQualityCheck({
      title,
      excerpt,
      content,
      tags,
      viewsCount: existing.views_count || 0,
      commentSample: (commentRows || []).map((c) => c.content),
    })
    if (quality) {
      const service = createServiceClient()
      await service
        .from('ai_quality_scores')
        .upsert(
          {
            subject_user_id: user.id,
            content_type: 'greymatters_post',
            post_id: existing.id,
            score: quality.score,
            notes: quality.notes,
            provider: quality.provider,
            authenticity_flag: quality.authenticityFlag,
            scored_at: new Date().toISOString(),
          },
          { onConflict: 'post_id' }
        )
    }
  }

  return NextResponse.redirect(absoluteUrl('/posts'))
}
