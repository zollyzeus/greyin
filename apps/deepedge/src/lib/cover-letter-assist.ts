import { complete } from './llm/client'

export interface CoverLetterCandidate {
  current_title: string | null
  skills: string[]
  experience_years: number | null
}

export interface CoverLetterJob {
  title: string
  description: string
  companyName: string | null
}

/**
 * AI enhancement (Phase A1, "assist" pattern -- see GigQualityAssist.tsx/
 * getGigListingSuggestions() for the reference this mirrors). Stateless,
 * free, no credit consumed, never auto-submits: the draft is inserted
 * into the cover letter textarea on click, the candidate reviews/edits
 * it like any other draft before hitting Submit Application.
 */
export async function draftCoverLetter(candidate: CoverLetterCandidate, job: CoverLetterJob): Promise<string | null> {
  const system = `You write a short, specific draft cover letter for a job application on DeepEdge. Ground it in the candidate's real background and the actual job description -- never generic filler ("I am a hard worker", "I am excited about this opportunity"), never invent experience the candidate didn't state. 3 short paragraphs at most. Respond with ONLY the cover letter text, no preamble, no markdown, no signature block.`

  const prompt = [
    `Job: ${job.title}${job.companyName ? ` at ${job.companyName}` : ''}`,
    `Job description: ${job.description}`,
    '',
    candidate.current_title ? `Candidate's current title: ${candidate.current_title}` : '',
    candidate.skills.length ? `Candidate's skills: ${candidate.skills.join(', ')}` : '',
    candidate.experience_years != null ? `Candidate's experience: ${candidate.experience_years} years` : '',
  ].filter(Boolean).join('\n')

  const result = await complete('deepedge_cover_letter_assist', system, prompt, 500)
  if (!result.ok) return null
  return result.text.trim()
}
