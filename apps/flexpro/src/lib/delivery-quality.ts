import { complete } from './llm/client'

interface DeliveryQualityInput {
  gigTitle: string
  gigCategory: string | null
  requirements: string | null
  deliveryMessage: string | null
  buyerRating: number
  buyerReviewText: string | null
}

function buildPrompt(input: DeliveryQualityInput) {
  // FlexPro gigs span both technical work (dev, data, ops) and
  // non-technical work (design, writing, admin support) -- there's no
  // single "was it technically correct" bar that applies to all of them.
  // The one signal every gig DOES have, regardless of category, is the
  // buyer's own rating and review text -- the closest thing to a
  // sentiment/engagement signal this pillar has (FlexPro has no
  // separate delivery-quality vote mechanism). For technical categories
  // the delivery message is also checked against the stated
  // requirements; for everything else the buyer's own reaction is
  // weighted most heavily.
  const system = `You are reviewing the quality of a freelancer's delivered work on FlexPro, a freelance marketplace. First decide whether this gig is primarily technical (development, data, IT/ops) or non-technical (design, writing, marketing, admin, etc.).

If technical: score mainly on how well the delivery message addresses the stated requirements -- completeness and specificity, not just a vague "done."

If non-technical: score mainly on the buyer's own rating and review text (their sentiment is the best available signal of delivered quality for this kind of work), with the delivery message as secondary context.

In both cases, a buyer rating of 4-5 stars with a substantive positive review should pull the score up; a low rating or a review describing problems should pull it down, regardless of category.

Respond in exactly this format:
SCORE: <integer 0-100>
NOTES: <2-4 sentence rationale, including which mode (requirements-based vs. sentiment-weighted) you judged it under>`

  const prompt = [
    `Gig: ${input.gigTitle}`,
    input.gigCategory ? `Category: ${input.gigCategory}` : '',
    input.requirements ? `Buyer's stated requirements: ${input.requirements}` : '',
    '',
    `Delivery message from the freelancer: ${input.deliveryMessage || '(none provided)'}`,
    '',
    `Buyer rating: ${input.buyerRating}/5`,
    input.buyerReviewText ? `Buyer review: ${input.buyerReviewText}` : 'Buyer left no written review.',
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

/** Returns null when AI review is unavailable (feature disabled, no provider configured, or every provider failed) -- callers must just skip storing/showing a score, never block the review submission on it. */
export async function runDeliveryQualityCheck(input: DeliveryQualityInput): Promise<{ score: number; notes: string; provider: string } | null> {
  const { system, prompt } = buildPrompt(input)
  const result = await complete('flexpro_delivery_quality', system, prompt)
  if (!result.ok) return null

  const parsed = parseScore(result.text)
  if (!parsed) return null

  return { ...parsed, provider: result.provider }
}
