import { complete } from './llm/client'

export interface InterviewPrepCandidate {
  current_title: string | null
  skills: string[]
  experience_years: number | null
}

export interface InterviewPrepJob {
  title: string
  description: string
  skillsRequired: string[]
}

/**
 * AI enhancement (Phase B1). On-demand, no persistence -- a fresh
 * generation per view is cheap and avoids stale questions if the job
 * posting changes; only offered once an application reaches the real
 * 'interview' status (applications.status, already a valid CHECK value).
 */
export async function generateInterviewQuestions(candidate: InterviewPrepCandidate, job: InterviewPrepJob): Promise<string | null> {
  const system = `You help a candidate prepare for a real job interview on DeepEdge. Given the job description and the candidate's own background, generate 5 likely interview questions for this specific role -- a mix of technical/role-specific and behavioral, grounded in what the job description and candidate profile actually say, not generic filler questions. Respond with ONLY a numbered list of 5 questions, one per line, no preamble, no answers.`

  const prompt = [
    `Job: ${job.title}`,
    `Description: ${job.description}`,
    job.skillsRequired.length ? `Required skills: ${job.skillsRequired.join(', ')}` : '',
    '',
    candidate.current_title ? `Candidate's current title: ${candidate.current_title}` : '',
    candidate.skills.length ? `Candidate's skills: ${candidate.skills.join(', ')}` : '',
    candidate.experience_years != null ? `Candidate's experience: ${candidate.experience_years} years` : '',
  ].filter(Boolean).join('\n')

  const result = await complete('deepedge_interview_prep', system, prompt, 500)
  if (!result.ok) return null
  return result.text.trim()
}
