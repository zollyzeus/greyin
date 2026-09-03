import { complete } from './llm/client'

export interface ParsedSearchQuery {
  intent: 'people' | 'content'
  keywords: string
  min_verified_outcomes?: number
  availability?: string
  location?: string
}

const SYSTEM_PROMPT = `You turn a search query for a professional platform into strict JSON, nothing else.
Schema: {"intent": "people" | "content", "keywords": string, "min_verified_outcomes"?: number, "availability"?: string, "location"?: string}
"intent" is "people" if the query is looking for a person/expert/freelancer/mentor to hire or contact (e.g. "senior React freelancers", "mentors in fintech"), "content" if it's looking for a job posting, gig listing, article, discussion, or project (e.g. "remote engineering jobs", "posts about hiring").
"keywords" is the core search term(s) with filler words removed (e.g. "senior React freelancers available this month with 4+ verified outcomes" -> keywords: "React").
"min_verified_outcomes" is a number only if the query mentions a minimum count of verified/proven work.
"availability" is one of "immediate","2weeks","1month","not_available" only if clearly implied.
"location" only if a specific place is mentioned.
Omit any field you can't confidently infer. Respond with ONLY the JSON object, no markdown, no explanation.`

/**
 * Routes a free-text ecosystem-search query through the LLM to extract
 * structured filters before querying platform_search_index (content)
 * or platform_people_index (people, 060) -- additive on top of the
 * existing plain-keyword search, not a replacement for it. Never
 * throws and never blocks the page: no configured provider, a failed
 * call, or unparseable output all fall back to a plain content
 * keyword search using the raw query, exactly today's existing
 * behavior -- same "lazy, best-effort" posture as
 * sweepUnscoredReplies/finalize_expired_verified_outcomes.
 */
export async function parseSearchQuery(query: string): Promise<ParsedSearchQuery> {
  const fallback: ParsedSearchQuery = { intent: 'content', keywords: query }

  const result = await complete('ecosystem_nl_search', SYSTEM_PROMPT, query, 300)
  if (!result.ok) {
    return fallback
  }

  try {
    // Models sometimes wrap JSON in a markdown fence despite instructions.
    const cleaned = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    const parsed = JSON.parse(cleaned)
    if (parsed.intent !== 'people' && parsed.intent !== 'content') {
      return fallback
    }
    if (typeof parsed.keywords !== 'string' || !parsed.keywords.trim()) {
      return fallback
    }
    return {
      intent: parsed.intent,
      keywords: parsed.keywords,
      min_verified_outcomes: typeof parsed.min_verified_outcomes === 'number' ? parsed.min_verified_outcomes : undefined,
      availability: typeof parsed.availability === 'string' ? parsed.availability : undefined,
      location: typeof parsed.location === 'string' ? parsed.location : undefined,
    }
  } catch {
    return fallback
  }
}
