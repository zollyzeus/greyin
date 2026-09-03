import { complete } from './llm/client'

export const VERIFICATION_PASS_THRESHOLD = 70

interface VerificationInput {
  projectTitle: string
  projectDescription: string | null
  askRoleTitle: string
  askDescription: string | null
  verificationCriteria: string | null
  submittedSummary: string
  evidenceUrl: string | null
}

function buildPrompt(input: VerificationInput) {
  const system = `You are reviewing whether submitted work satisfies a project ask on StackWorks, a platform where experienced Builders post project asks and Supporters complete them to build a verified track record. Score the submission from 0-100 based on how well it satisfies the ask's requirements and any verification criteria provided. Respond in exactly this format:
SCORE: <integer 0-100>
NOTES: <2-4 sentence rationale>`

  const prompt = [
    `Project: ${input.projectTitle}`,
    input.projectDescription ? `Project description: ${input.projectDescription}` : '',
    '',
    `Ask: ${input.askRoleTitle}`,
    input.askDescription ? `Ask description: ${input.askDescription}` : '',
    input.verificationCriteria ? `Verification criteria (test against this specifically): ${input.verificationCriteria}` : '',
    '',
    `Submitted work summary: ${input.submittedSummary}`,
    input.evidenceUrl ? `Evidence link: ${input.evidenceUrl}` : '',
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

/** Returns null when AI review is unavailable (feature disabled, no provider configured, or every provider failed) -- callers must fall back to manual-review-only rather than fail the submission. */
export async function runAIVerification(input: VerificationInput): Promise<{ score: number; notes: string; provider: string } | null> {
  const { system, prompt } = buildPrompt(input)
  const result = await complete('stackworks_verification', system, prompt)
  if (!result.ok) return null

  const parsed = parseScore(result.text)
  if (!parsed) return null

  return { ...parsed, provider: result.provider }
}
