import { complete } from './llm/client'

/**
 * Gap-audit item #4: AI feedback on a gig LISTING at post-time, distinct
 * from ai-quality-score's review of a completed DELIVERY (FR-FA-06).
 * Different lifecycle moment, informational only -- this never gates
 * Publish (see api/gigs/quality-check/route.ts's own comment on why it
 * must stay uncredited too). Modeled on
 * apps/saltnpepper-community/src/lib/reply-quality.ts's shape
 * (buildPrompt/parse/run), minus the persisted-score table -- a draft
 * suggestion has nothing to key a row on until the gig actually exists.
 */

function buildPrompt(title: string, description: string) {
  const system = `You are reviewing a gig listing for FlexPro, a freelance marketplace for
experienced professionals. Give the seller 2-4 sentences of concrete, actionable
feedback to make their listing clearer and more likely to convert a buyer --
things like a vague title, missing scope/deliverables, no mention of turnaround,
or unclear pricing signals. Be specific to what's actually written, not generic
advice. If the listing is already clear and complete, say so briefly rather than
inventing nitpicks.`

  const prompt = `Gig title: ${title}\n\nGig description: ${description}`
  return { system, prompt }
}

export async function getGigListingSuggestions(title: string, description: string): Promise<{ suggestions: string; provider: string } | null> {
  const { system, prompt } = buildPrompt(title, description)
  const result = await complete('flexpro_gig_quality', system, prompt, 400)
  if (!result.ok) {
    return null
  }
  return { suggestions: result.text.trim(), provider: result.provider }
}
