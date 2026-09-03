import { complete } from './llm/client'
import { createServiceClient } from './supabase/service'

interface ReplyQualityInput {
  discussionTitle: string
  discussionBody: string
  discussionUpvoteCount: number
  replyBody: string
}

function buildPrompt(input: ReplyQualityInput) {
  // Salt & Pepper has no per-reply reaction/upvote mechanism (confirmed
  // -- discussions.upvote_count exists on the thread itself, but nothing
  // tracks whether a specific *reply* was well-received). So unlike
  // GreyMatters (views/comments) or FlexPro (buyer rating/review),
  // there's no real engagement signal to feed in at reply granularity --
  // this is judged directly on how helpful/actionable the mentoring
  // response reads in context of the actual question asked, which is
  // the most honest signal available today.
  const system = `You are reviewing the quality of a mentoring reply on Salt & Pepper, a peer community for experienced professionals answering each other's questions. Judge how helpful, specific, and actionable the reply is as a response to the question actually asked -- a generic "have you tried Googling it" answer should score low even if well-written; a reply that draws on real experience and gives the asker something concrete to act on should score high, regardless of length.

Respond in exactly this format:
SCORE: <integer 0-100>
NOTES: <2-4 sentence rationale>`

  const prompt = [
    `Question: ${input.discussionTitle}`,
    input.discussionBody ? `Question details: ${input.discussionBody}` : '',
    `(This thread has ${input.discussionUpvoteCount} upvote${input.discussionUpvoteCount === 1 ? '' : 's'} from the community.)`,
    '',
    `Reply being reviewed: ${input.replyBody}`,
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

/** Returns null when AI review is unavailable (feature disabled, no provider configured, or every provider failed) -- callers must just skip the reply for this pass, never block on it. */
export async function runReplyQualityCheck(input: ReplyQualityInput): Promise<{ score: number; notes: string; provider: string } | null> {
  const { system, prompt } = buildPrompt(input)
  const result = await complete('saltnpepper_reply_quality', system, prompt)
  if (!result.ok) return null

  const parsed = parseScore(result.text)
  if (!parsed) return null

  return { ...parsed, provider: result.provider }
}

/**
 * Lazy, bounded catch-up for unscored replies -- no pg_cron in this
 * deployment (same constraint noted throughout this codebase), so
 * there's no schedule to hang this off of. Two callers:
 *
 * - discussions/[id]/page.tsx passes `discussionId` to score just that
 *   thread's own backlog (up to `limit`) for fast feedback while someone
 *   is actively reading it.
 * - dashboard/page.tsx calls this with no `discussionId`, sweeping the
 *   platform-wide backlog instead -- unlike a single thread (only
 *   scored if someone happens to revisit it), /dashboard is something
 *   every logged-in member hits routinely regardless of whose reply is
 *   actually missing a score, so this is the real safety net that keeps
 *   the backlog from silently growing forever.
 *
 * Bounded per call either way so one page load can't trigger an
 * unbounded batch of LLM calls.
 */
export async function sweepUnscoredReplies(limit = 3, discussionId?: string): Promise<{ swept: number; remaining: number }> {
  const service = createServiceClient()

  let query = service
    .from('discussion_replies')
    .select('id, author_id, body, discussions ( title, body, upvote_count )')
    .order('created_at', { ascending: false })
    .limit(discussionId ? limit + 20 : 50)
  if (discussionId) {
    query = query.eq('discussion_id', discussionId)
  }
  const { data: replies } = await query

  if (!replies || replies.length === 0) return { swept: 0, remaining: 0 }

  const replyIds = replies.map((r: any) => r.id)
  const { data: existingScores } = await service
    .from('ai_quality_scores')
    .select('discussion_reply_id')
    .eq('content_type', 'saltnpepper_reply')
    .in('discussion_reply_id', replyIds)
  const scoredIds = new Set((existingScores || []).map((s) => s.discussion_reply_id))
  const allUnscored = replies.filter((r: any) => !scoredIds.has(r.id))
  const unscored = allUnscored.slice(0, limit)
  let swept = 0

  for (const reply of unscored as any[]) {
    const discussion = reply.discussions
    const quality = await runReplyQualityCheck({
      discussionTitle: discussion?.title || '',
      discussionBody: discussion?.body || '',
      discussionUpvoteCount: discussion?.upvote_count || 0,
      replyBody: reply.body,
    })
    if (quality) {
      await service.from('ai_quality_scores').upsert(
        {
          subject_user_id: reply.author_id,
          content_type: 'saltnpepper_reply',
          discussion_reply_id: reply.id,
          score: quality.score,
          notes: quality.notes,
          provider: quality.provider,
          scored_at: new Date().toISOString(),
        },
        { onConflict: 'discussion_reply_id' }
      )
      swept++
    }
  }

  return { swept, remaining: allUnscored.length - swept }
}

/**
 * Timer-driven counterpart to sweepUnscoredReplies() -- called from
 * src/instrumentation.ts's setInterval, not from a page. The page-visit
 * sweeps (per-thread and the /dashboard global one) only run when
 * someone happens to load the right page; this makes progress on a
 * schedule regardless of traffic, admin-configured via
 * llm_feature_flags.sweep_interval_minutes (050_ai_sweep_observability.sql).
 * NULL interval (the default) means this is a no-op every tick.
 *
 * "Claims" the run by writing last_swept_at BEFORE actually sweeping --
 * see the identical reasoning in GreyMatters' runPeriodicSweepIfDue();
 * this app also runs a single replica today.
 */
export async function runPeriodicSweepIfDue(limit = 5): Promise<void> {
  const service = createServiceClient()

  const { data: flag } = await service
    .from('llm_feature_flags')
    .select('sweep_interval_minutes, last_swept_at')
    .eq('feature_key', 'saltnpepper_reply_quality')
    .maybeSingle()

  if (!flag?.sweep_interval_minutes) return

  const dueAt = flag.last_swept_at
    ? new Date(flag.last_swept_at).getTime() + flag.sweep_interval_minutes * 60_000
    : 0
  if (Date.now() < dueAt) return

  await service
    .from('llm_feature_flags')
    .update({ last_swept_at: new Date().toISOString() })
    .eq('feature_key', 'saltnpepper_reply_quality')

  await sweepUnscoredReplies(limit)
}
