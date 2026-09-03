import { createClient } from '@/app/lib/supabase/server'
import { createServiceClient } from '@/app/lib/supabase/service'
import { absoluteUrl } from '@/app/lib/site-url'
import { runPostQualityCheck } from '@/app/lib/post-quality'
import { NextResponse } from 'next/server'

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function POST(request: Request) {
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
  const status = (formData.get('status') as string) === 'published' ? 'published' : 'draft'
  const coverImageUrl = (formData.get('cover_image_url') as string || '').trim() || null
  const viewAudienceRaw = formData.get('view_audience') as string
  const viewAudience = ['public', 'follower', 'verified_expert'].includes(viewAudienceRaw) ? viewAudienceRaw : 'public'
  const commentAudienceRaw = formData.get('comment_audience') as string
  const commentAudience = ['public', 'follower', 'verified_expert'].includes(commentAudienceRaw) ? commentAudienceRaw : 'public'
  const feedVisibilityRaw = formData.get('feed_visibility') as string
  const feedVisibility = ['public', 'followers', 'private'].includes(feedVisibilityRaw) ? feedVisibilityRaw : 'public'
  // Comma-separated input -- tags has never had a write path anywhere in
  // this app (always hardcoded to []), which is also why /tags/{tag}
  // links on post pages were always dead: nothing could ever populate
  // them. Trimmed/deduped/lowercased so /tags/{tag} matches consistently.
  const tags = Array.from(new Set(
    ((formData.get('tags') as string) || '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  ))

  if (!title || !content) {
    return NextResponse.redirect(absoluteUrl('/posts/new?error=' + encodeURIComponent('Title and content are required.')))
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      author_id: user.id,
      title,
      slug: `${slugify(title)}-${Math.random().toString(36).slice(2, 8)}`,
      excerpt,
      content,
      category_id: categoryId,
      cover_image_url: coverImageUrl,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
      view_audience: viewAudience,
      comment_audience: commentAudience,
      feed_visibility: feedVisibility,
      tags,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Post creation failed:', error)
    // RLS blocks INSERT for anyone who isn't a Verified Expert (12+ years
    // or Greyin Score 75+, migration 038) or admin -- earned, not a
    // stored role, so surface that distinctly instead of a generic failure.
    const message = error.code === '42501'
      ? 'Only Verified Experts can publish posts.'
      : 'Could not create post. Please try again.'
    return NextResponse.redirect(absoluteUrl('/posts/new?error=' + encodeURIComponent(message)))
  }

  // AI quality score feeds greyin_scores as GreyMatters' platform input
  // (048_ai_quality_scores.sql) -- only scored once actually published,
  // same reasoning StackWorks only scores a real submission, not a draft.
  if (post && status === 'published') {
    const quality = await runPostQualityCheck({
      title,
      excerpt,
      content,
      tags,
      viewsCount: 0,
      commentSample: [],
    })
    if (quality) {
      const service = createServiceClient()
      await service
        .from('ai_quality_scores')
        .upsert(
          {
            subject_user_id: user.id,
            content_type: 'greymatters_post',
            post_id: post.id,
            score: quality.score,
            notes: quality.notes,
            provider: quality.provider,
            scored_at: new Date().toISOString(),
          },
          { onConflict: 'post_id' }
        )
    }
  }

  return NextResponse.redirect(absoluteUrl('/posts'))
}
