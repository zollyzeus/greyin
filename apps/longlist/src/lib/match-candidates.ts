import { complete } from '@/lib/llm/client'
import { createServiceClient } from '@/lib/supabase/service'

export type MatchedCandidate = {
  user_id: string
  full_name: string | null
  reason: string
}

/**
 * The second, AI-surfaced set of candidates -- distinct from explicit
 * future_role_subscriptions. Reads platform_people_index (060, extended
 * 087 with future_interests/future_interests_note) rather than every
 * profile, so this only ever considers people who've actually stated a
 * skill or a future interest -- an empty profile can't get surfaced.
 * Excludes anyone already subscribed, since they're shown separately.
 *
 * NFR-REL-01 pattern: never throws, degrades to an empty list (not an
 * error) if the feature is off, no provider is configured, or the LLM
 * call fails -- explicit subscribers are always shown regardless, so
 * this failing costs a "nice to have" second list, never the core flow.
 */
export async function matchCandidatesForRole(
  role: { title: string; description: string; skills: string[]; function_area: string | null; seniority_level: string | null },
  excludeUserIds: string[]
): Promise<MatchedCandidate[]> {
  const service = createServiceClient()

  const { data: people } = await service
    .from('platform_people_index')
    .select('user_id, full_name, skills, future_interests, future_interests_note, current_title')
    .not('user_id', 'in', `(${excludeUserIds.length ? excludeUserIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
    .or('future_interests.neq.{},future_interests_note.not.is.null')
    .limit(200)

  if (!people || people.length === 0) {
    return []
  }

  const roster = people.map((p) => ({
    id: p.user_id,
    title: p.current_title,
    skills: p.skills,
    future_interests: p.future_interests,
    note: p.future_interests_note,
  }))

  const result = await complete(
    'longlist_candidate_matching',
    'You match candidates on a professional network to a future job opening based on stated skills and future interests. Respond ONLY with valid JSON, no markdown fences: {"matches": [{"id": "<uuid>", "reason": "<one short sentence>"}]}. Include at most 8 matches, best fit first. If nothing is a reasonable fit, return {"matches": []}.',
    `Future role: ${role.title} (${role.seniority_level ?? 'level not specified'}, ${role.function_area ?? 'area not specified'})\nDescription: ${role.description}\nDesired skills: ${role.skills.join(', ') || 'none listed'}\n\nCandidate roster (JSON):\n${JSON.stringify(roster)}`,
    1500
  )

  if (!result.ok) {
    return []
  }

  try {
    const parsed = JSON.parse(result.text.trim().replace(/^```json/, '').replace(/^```/, '').replace(/```$/, ''))
    const matches: { id: string; reason: string }[] = parsed.matches || []
    const byId = new Map(people.map((p) => [p.user_id, p.full_name]))
    return matches
      .filter((m) => byId.has(m.id))
      .map((m) => ({ user_id: m.id, full_name: byId.get(m.id) ?? null, reason: m.reason }))
  } catch {
    return []
  }
}
