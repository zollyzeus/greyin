import { complete } from './llm/client'

/**
 * AI enhancement (Phase A2, "assist" pattern -- direct mirror of
 * FlexPro's getGigListingSuggestions()/GigQualityAssist.tsx, which
 * DeepEdge's own job posting never got). Stateless, free, informational
 * only -- returns a suggestions blob the employer reads and manually
 * copies into the real form fields, same display-not-auto-fill shape as
 * the FlexPro original, deliberately not auto-injecting into
 * title/description/skills_required/experience_min to avoid silently
 * overwriting something the employer already wrote.
 */
export async function getJobPostSuggestions(title: string, description: string): Promise<string | null> {
  const system = `You help an employer improve a draft job posting on DeepEdge before they publish it. Given a title and description, suggest: (1) 2-3 sentences to add or clarify if the description is thin (responsibilities, what success looks like), (2) a comma-separated list of specific required skills implied by the role, (3) a reasonable minimum years of experience for this level of role. Be concrete and specific to what's actually written -- never generic boilerplate. Keep the whole response to 4-6 short lines.`

  const prompt = `Title: ${title}\nDescription: ${description}`

  const result = await complete('deepedge_job_post_assist', system, prompt, 400)
  if (!result.ok) return null
  return result.text.trim()
}
