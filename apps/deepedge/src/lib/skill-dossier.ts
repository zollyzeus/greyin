import { complete } from './llm/client'
import { createServiceClient } from './supabase/service'

/**
 * AI enhancement (Phase C1, "11 new AI enhancements" plan) -- the
 * strongest moat item of the 11: reads the SAME real evidence tables
 * greyin_scores already aggregates (not just the pre-computed scores)
 * to get real specifics -- project titles, review text, post titles --
 * then one complete() call synthesizes a narrative no competitor with
 * single-vertical data could produce. Live/on-demand, no new table --
 * a profile page is read far less often than the jobs-listing page that
 * needed caching for its own different (read-volume) reasons.
 */
export async function buildSkillDossier(userId: string): Promise<string | null> {
  const service = createServiceClient()

  const [outcomesRes, reviewsRes, postsRes, reputationRes] = await Promise.all([
    service
      .from('verified_outcomes')
      .select('outcome_type, score, notes, builder_projects ( title )')
      .eq('subject_user_id', userId)
      .eq('status', 'verified'),
    service
      .from('order_reviews')
      .select('rating, review_text, gigs ( title )')
      .eq('reviewee_id', userId),
    service
      .from('ai_quality_scores')
      .select('score, posts ( title )')
      .eq('subject_user_id', userId)
      .eq('content_type', 'greymatters_post'),
    service
      .from('reputation_events')
      .select('points')
      .eq('user_id', userId)
      .eq('event_type', 'project_upvoted'),
  ])

  const outcomes = outcomesRes.data || []
  const reviews = reviewsRes.data || []
  const posts = postsRes.data || []
  const reputationPoints = (reputationRes.data || []).reduce((sum, r) => sum + r.points, 0)

  if (outcomes.length === 0 && reviews.length === 0 && posts.length === 0 && reputationPoints === 0) {
    return null
  }

  const lines = [
    outcomes.length
      ? `StackWorks (${outcomes.length} verified outcome${outcomes.length === 1 ? '' : 's'}):\n` +
        outcomes.map((o: any) => `- ${o.outcome_type}${o.builder_projects?.title ? ` on "${o.builder_projects.title}"` : ''}, score ${o.score}/100${o.notes ? ` -- ${o.notes}` : ''}`).join('\n')
      : '',
    reviews.length
      ? `FlexPro (${reviews.length} buyer review${reviews.length === 1 ? '' : 's'}):\n` +
        reviews.map((r: any) => `- ${r.rating}/5 on "${r.gigs?.title || 'a gig'}"${r.review_text ? `: "${r.review_text}"` : ''}`).join('\n')
      : '',
    posts.length
      ? `GreyMatters (${posts.length} AI-scored post${posts.length === 1 ? '' : 's'}):\n` +
        posts.map((p: any) => `- "${p.posts?.title || 'a post'}", quality score ${p.score}/100`).join('\n')
      : '',
    reputationPoints > 0 ? `Salt & Pepper: ${reputationPoints} community reputation points from real upvoted contributions.` : '',
  ].filter(Boolean).join('\n\n')

  const system = `You write a short, factual "verified profile" summary for a professional networking platform, synthesizing a person's real, verified activity across multiple platforms into one coherent narrative. Only state what's actually given -- never invent numbers, quotes, or achievements not in the evidence. 2-3 short paragraphs. Respond with ONLY the summary, no preamble, no markdown headers.`

  const result = await complete('deepedge_skill_dossier', system, lines, 500)
  if (!result.ok) return null
  return result.text.trim()
}
