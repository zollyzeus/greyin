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
 *
 * `realQuestions` (Skillmeet.ai comparison round, 2026-09-12) is the
 * crowdsourced interview_question_logs corpus for this specific company
 * (151) -- when present, grounds the prompt in what candidates actually
 * reported instead of purely generic LLM output, closing the gap against
 * Skillmeet's Locus agent (real-frequency-ranked questions per company).
 * Still no persistence of the generated output itself, same as before.
 */
export async function generateInterviewQuestions(
  candidate: InterviewPrepCandidate,
  job: InterviewPrepJob,
  realQuestions: string[] = []
): Promise<string | null> {
  const system = realQuestions.length
    ? `You help a candidate prepare for a real job interview on DeepEdge. You are given real interview questions previous candidates reported for this same company, the job description, and the candidate's own background. Generate 5 likely interview questions for this specific role -- prioritize adapting or directly reusing the real reported questions where they fit this role, and fill any remaining gaps with role-specific/behavioral questions grounded in the job description and candidate profile. Respond with ONLY a numbered list of 5 questions, one per line, no preamble, no answers.`
    : `You help a candidate prepare for a real job interview on DeepEdge. Given the job description and the candidate's own background, generate 5 likely interview questions for this specific role -- a mix of technical/role-specific and behavioral, grounded in what the job description and candidate profile actually say, not generic filler questions. Respond with ONLY a numbered list of 5 questions, one per line, no preamble, no answers.`

  const prompt = [
    `Job: ${job.title}`,
    `Description: ${job.description}`,
    job.skillsRequired.length ? `Required skills: ${job.skillsRequired.join(', ')}` : '',
    '',
    candidate.current_title ? `Candidate's current title: ${candidate.current_title}` : '',
    candidate.skills.length ? `Candidate's skills: ${candidate.skills.join(', ')}` : '',
    candidate.experience_years != null ? `Candidate's experience: ${candidate.experience_years} years` : '',
    realQuestions.length ? `\nReal questions previously reported for this company:\n${realQuestions.map((q) => `- ${q}`).join('\n')}` : '',
  ].filter(Boolean).join('\n')

  const result = await complete('deepedge_interview_prep', system, prompt, 500)
  if (!result.ok) return null
  return result.text.trim()
}
