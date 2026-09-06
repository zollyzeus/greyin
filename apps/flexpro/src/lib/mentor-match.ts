import { complete } from './llm/client'

export interface MentorGigOption {
  id: string
  title: string
  description: string
  mentorName: string
  sellerRating: number
  totalReviews: number
}

export interface MentorPick {
  gig: MentorGigOption
  reason: string
}

const SYSTEM_PROMPT = `You recommend mentors on FlexPro's mentor-sessions marketplace to a user based on their stated future career interests. You will be given the user's interests and a numbered list of available mentor session gigs (title, description, and the mentor's overall rating/review count from their FlexPro work). Pick up to 3 gigs that best fit the user's stated interests, ordered best fit first. If none are a good fit, return an empty list. Only use what's actually in the listing -- never invent detail it doesn't contain.
Respond with ONLY strict JSON, no markdown: {"picks": [{"index": <the option number>, "reason": "<one sentence tailored to why this fits their stated interests>"}]}`

/**
 * Real-time, per-request ranking -- same posture as
 * parse-search-query.ts's NL-search (048): no new table, nothing
 * persisted, a failure/disabled-flag/unparseable-output all fall back to
 * null so the caller just renders its existing plain reverse-chron list
 * unchanged. Requires at least 2 gigs to be worth ranking at all.
 */
export async function rankMentorGigs(
  gigs: MentorGigOption[],
  futureInterests: string[],
  futureInterestsNote: string | null
): Promise<MentorPick[] | null> {
  if (gigs.length < 2 || futureInterests.length === 0) return null

  const interestsLine = [
    `Stated future interests: ${futureInterests.join(', ')}`,
    futureInterestsNote ? `Additional context: ${futureInterestsNote}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const listing = gigs
    .map((g, i) => `${i + 1}. ${g.title} — ${g.description} (mentor: ${g.sellerRating.toFixed(1)}★, ${g.totalReviews} reviews)`)
    .join('\n')

  const result = await complete('flexpro_mentor_matching', SYSTEM_PROMPT, `${interestsLine}\n\n${listing}`, 500)
  if (!result.ok) return null

  try {
    const cleaned = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed.picks)) return null

    const picks: MentorPick[] = []
    const seen = new Set<number>()
    for (const pick of parsed.picks) {
      const index = pick?.index
      const reason = pick?.reason
      if (typeof index !== 'number' || typeof reason !== 'string' || !reason.trim()) continue
      const gig = gigs[index - 1]
      if (!gig || seen.has(index)) continue
      seen.add(index)
      picks.push({ gig, reason: reason.trim() })
      if (picks.length >= 3) break
    }
    return picks.length > 0 ? picks : null
  } catch {
    return null
  }
}
