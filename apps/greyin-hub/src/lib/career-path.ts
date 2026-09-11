import { complete } from './llm/client'
import { createServiceClient } from './supabase/service'

/**
 * AI enhancement (Phase C2, "11 new AI enhancements" plan) -- lives on
 * the Hub, not any single pillar app, because it reads the user's own
 * already-aggregated cross-pillar greyin_scores row (all 4 pillar
 * breakdowns + years_experience), the same "no pillar affiliation of its
 * own" home used for every other cross-pillar dashboard section here.
 * Live/on-demand, no new table -- one dashboard view per user session is
 * cheap enough not to need C3's scheduled-report treatment.
 */
export async function projectCareerPath(userId: string): Promise<string | null> {
  const service = createServiceClient()

  const { data: scoreRow } = await service
    .from('greyin_scores')
    .select('stackworks_score, stackworks_evidence, flexpro_score, flexpro_evidence, saltnpepper_score, saltnpepper_evidence, greymatters_score, greymatters_evidence, platform_composite, years_experience')
    .eq('user_id', userId)
    .maybeSingle()

  if (!scoreRow) return null

  const pillars = [
    scoreRow.stackworks_score != null ? `StackWorks: ${scoreRow.stackworks_score}/100 (${scoreRow.stackworks_evidence} verified outcome${scoreRow.stackworks_evidence === 1 ? '' : 's'})` : '',
    scoreRow.flexpro_score != null ? `FlexPro: ${scoreRow.flexpro_score}/100 (${scoreRow.flexpro_evidence} buyer review${scoreRow.flexpro_evidence === 1 ? '' : 's'})` : '',
    scoreRow.saltnpepper_score != null ? `Salt & Pepper: ${scoreRow.saltnpepper_score}/100 (${scoreRow.saltnpepper_evidence} community signal${scoreRow.saltnpepper_evidence === 1 ? '' : 's'})` : '',
    scoreRow.greymatters_score != null ? `GreyMatters: ${scoreRow.greymatters_score}/100 (${scoreRow.greymatters_evidence} AI-scored post${scoreRow.greymatters_evidence === 1 ? '' : 's'})` : '',
  ].filter(Boolean)

  if (pillars.length === 0) return null

  const lines = [
    `Years of experience: ${scoreRow.years_experience ?? 0}`,
    `Platform composite score: ${scoreRow.platform_composite ?? 'not yet computed'}/100`,
    '',
    'Pillar breakdown:',
    ...pillars.map((p) => `- ${p}`),
  ].join('\n')

  const system = `You write a short, encouraging career-path projection for a professional based on their real, verified cross-platform activity. Given their pillar scores and experience, name ONE plausible next step (a role, a specialization, a level-up) and the ONE clearest gap to close to get there. Only reason from the numbers given -- never invent specific projects, employers, or achievements not in the evidence. 2 short paragraphs max. Respond with ONLY the projection, no preamble, no markdown headers.`

  const result = await complete('greyin_hub_career_path', system, lines, 400)
  if (!result.ok) return null
  return result.text.trim()
}
