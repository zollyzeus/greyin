import { complete } from './llm/client'
import { createServiceClient } from './supabase/service'

interface PostQualityInput {
  title: string
  excerpt: string | null
  content: string
  tags: string[]
  viewsCount: number
  commentSample: string[]
}

function buildPrompt(input: PostQualityInput) {
  // A "great" GreyMatters post isn't always a deep technical tutorial --
  // career advice, industry commentary, and soft-skills pieces are
  // legitimate and common on this platform too. Judging those purely on
  // technical depth would unfairly tank their score, so the model is
  // asked to route itself: technical content gets judged on
  // completeness/depth/originality (the "technical moat" of the piece),
  // non-technical content gets judged mainly on how the audience
  // actually responded to it -- the closest thing to a quality signal
  // this platform has for that kind of writing, since there's no
  // separate like/upvote mechanism on posts (only view counts and
  // comments).
  const system = `You are reviewing the quality of a published blog post on GreyMatters, a technical community platform for experienced professionals. First decide whether this post is primarily a technical writeup (tutorial, deep dive, architecture/code discussion) or non-technical (career advice, industry opinion, soft skills, etc.).

If technical: score mainly on completeness, accuracy/rigor, and its "technical moat" -- depth and originality that a shallow AI-generated summary of the topic couldn't match.

If non-technical: score mainly on the engagement/sentiment evidence provided (view count relative to a typical post, and the tone/substance of any reader comments) as a proxy for how much value the audience actually got from it, alongside basic writing quality.

Respond in exactly this format:
SCORE: <integer 0-100>
NOTES: <2-4 sentence rationale, including which mode (technical vs. engagement-weighted) you judged it under>`

  const prompt = [
    `Title: ${input.title}`,
    input.excerpt ? `Excerpt: ${input.excerpt}` : '',
    input.tags.length ? `Tags: ${input.tags.join(', ')}` : '',
    '',
    `Content:\n${input.content}`,
    '',
    `Engagement signals -- view count: ${input.viewsCount}`,
    input.commentSample.length
      ? `Sample of reader comments:\n${input.commentSample.map((c) => `- ${c}`).join('\n')}`
      : 'No reader comments yet.',
  ]
    .filter(Boolean)
    .join('\n')

  return { system, prompt }
}

function parseScore(text: string): { score: number; notes: string } | null {
  const scoreMatch = text.match(/SCORE:\s*(\d+)/i)
  if (!scoreMatch) return null
  const notesMatch = text.match(/NOTES:\s*([\s\S]*)/i)
  const score = Math.max(0, Math.min(100, parseInt(scoreMatch[1], 10)))
  return { score, notes: notesMatch ? notesMatch[1].trim() : '' }
}

/** Returns null when AI review is unavailable (feature disabled, no provider configured, or every provider failed) -- callers must just skip showing/storing a score rather than fail the publish. */
export async function runPostQualityCheck(input: PostQualityInput): Promise<{ score: number; notes: string; provider: string } | null> {
  const { system, prompt } = buildPrompt(input)
  const result = await complete('greymatters_post_quality', system, prompt)
  if (!result.ok) return null

  const parsed = parseScore(result.text)
  if (!parsed) return null

  return { ...parsed, provider: result.provider }
}

/**
 * Safety-net catch-up for posts the create/update routes never scored --
 * chiefly ones published or status-changed directly via Supabase Studio,
 * which bypasses those routes entirely. No pg_cron in this deployment
 * (same constraint noted throughout this codebase, e.g.
 * finalize_expired_verified_outcomes()), so there's no schedule to hang
 * this off of. Instead: called from /dashboard, which -- unlike a single
 * discussion thread or a single post page -- every logged-in user hits
 * routinely regardless of whose content is actually missing a score, so
 * the platform-wide backlog keeps draining no matter who happens to be
 * browsing. Bounded per call so one dashboard visit can't trigger an
 * unbounded batch of LLM calls; global (not scoped to the visiting
 * user), since the point is clearing the shared backlog, not just this
 * user's own posts.
 */
export async function sweepUnscoredPosts(limit = 3): Promise<{ swept: number; remaining: number }> {
  const service = createServiceClient()

  const { data: recentPublished } = await service
    .from('posts')
    .select('id, author_id, title, excerpt, content, tags, views_count')
    .eq('status', 'published')
    .not('author_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(50)

  if (!recentPublished || recentPublished.length === 0) return { swept: 0, remaining: 0 }

  const postIds = recentPublished.map((p) => p.id)
  const { data: existingScores } = await service
    .from('ai_quality_scores')
    .select('post_id')
    .eq('content_type', 'greymatters_post')
    .in('post_id', postIds)
  const scoredIds = new Set((existingScores || []).map((s) => s.post_id))
  const allUnscored = recentPublished.filter((p) => !scoredIds.has(p.id))
  const unscored = allUnscored.slice(0, limit)
  let swept = 0

  for (const post of unscored) {
    const { data: commentRows } = await service
      .from('comments')
      .select('content')
      .eq('post_id', post.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(5)

    const quality = await runPostQualityCheck({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      tags: post.tags || [],
      viewsCount: post.views_count || 0,
      commentSample: (commentRows || []).map((c) => c.content),
    })
    if (quality) {
      await service.from('ai_quality_scores').upsert(
        {
          subject_user_id: post.author_id,
          content_type: 'greymatters_post',
          post_id: post.id,
          score: quality.score,
          notes: quality.notes,
          provider: quality.provider,
          scored_at: new Date().toISOString(),
        },
        { onConflict: 'post_id' }
      )
      swept++
    }
  }

  return { swept, remaining: allUnscored.length - swept }
}

/**
 * Timer-driven counterpart to sweepUnscoredPosts() -- called from
 * src/instrumentation.ts's setInterval, not from a page. The page-visit
 * sweep only runs when someone happens to load /dashboard; this makes
 * progress on a schedule regardless of traffic, admin-configured via
 * llm_feature_flags.sweep_interval_minutes (050_ai_sweep_observability.sql).
 * NULL interval (the default) means this is a no-op every tick --
 * periodic sweeping is opt-in, not on by default.
 *
 * "Claims" the run by writing last_swept_at BEFORE actually sweeping,
 * not after -- this app runs a single replica today (see
 * deployment/frontend-stack.yml), so a self-race isn't really possible,
 * but claiming first is cheap insurance if that ever changes, since it
 * shrinks the window in which two overlapping timers could both decide
 * a run is due.
 */
export async function runPeriodicSweepIfDue(limit = 5): Promise<void> {
  const service = createServiceClient()

  const { data: flag } = await service
    .from('llm_feature_flags')
    .select('sweep_interval_minutes, last_swept_at')
    .eq('feature_key', 'greymatters_post_quality')
    .maybeSingle()

  if (!flag?.sweep_interval_minutes) return

  const dueAt = flag.last_swept_at
    ? new Date(flag.last_swept_at).getTime() + flag.sweep_interval_minutes * 60_000
    : 0
  if (Date.now() < dueAt) return

  await service
    .from('llm_feature_flags')
    .update({ last_swept_at: new Date().toISOString() })
    .eq('feature_key', 'greymatters_post_quality')

  await sweepUnscoredPosts(limit)
}
