import { complete } from './llm/client'

export interface JobOption {
  id: string
  title: string
  description: string
  skills_required: string[]
  experience_min: number | null
  experience_max: number | null
  remote_type: string | null
  location: string | null
  salary_min: number | null
  salary_max: number | null
  currency: string | null
  applications_count: number | null
  company_name: string | null
}

export interface CandidateProfile {
  current_title: string | null
  skills: string[]
  education: string | null
  experience_years: number | null
  expected_salary_min: number | null
  expected_salary_max: number | null
  remote_preference: string | null
  willing_to_relocate: boolean | null
  availability: string | null
}

export interface JobPick {
  job: JobOption
  reason: string
}

function listingLine(j: JobOption, i: number) {
  const bits = [
    `${i + 1}. ${j.title} at ${j.company_name || 'a company'}`,
    j.skills_required.length ? `skills: ${j.skills_required.join(', ')}` : '',
    j.experience_min != null ? `experience: ${j.experience_min}+ yrs` : '',
    j.remote_type ? `work type: ${j.remote_type}` : '',
    j.location ? `location: ${j.location}` : '',
  ].filter(Boolean)
  return bits.join(' — ')
}

function parsePicks(text: string, jobs: JobOption[]): JobPick[] | null {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed.picks)) return null

    const picks: JobPick[] = []
    const seen = new Set<number>()
    for (const pick of parsed.picks) {
      const index = pick?.index
      const reason = pick?.reason
      if (typeof index !== 'number' || typeof reason !== 'string' || !reason.trim()) continue
      const job = jobs[index - 1]
      if (!job || seen.has(index)) continue
      seen.add(index)
      picks.push({ job, reason: reason.trim() })
      if (picks.length >= 5) break
    }
    return picks.length > 0 ? picks : null
  } catch {
    return null
  }
}

/**
 * (1) Based on resume/profile -- real-time LLM ranking, same posture as
 * flexpro's rankMentorGigs()/parse-search-query.ts: no new table, a
 * disabled flag/no provider/a failed call/unparseable output all fall
 * back to null so the caller just doesn't render this section.
 *
 * feedbackHint (Phase 2 of the recommendation-feedback loop, 125) is an
 * optional short summary of this candidate's own past negative feedback
 * ("tends to skip: onsite roles"), built by buildFeedbackHint() from
 * their real job_recommendation_feedback rows -- same trick
 * future_interests_note already plays on the mentor-matching prompt,
 * just behavior-sourced instead of stated.
 */
export async function recommendJobsFromProfile(candidate: CandidateProfile, jobs: JobOption[], feedbackHint?: string | null): Promise<JobPick[] | null> {
  if (jobs.length < 2) return null
  if (!candidate.current_title && candidate.skills.length === 0) return null

  const system = `You recommend job openings on DeepEdge to a candidate based on their professional profile. You'll be given the candidate's current title, skills, education, and years of experience, plus a numbered list of open jobs. Pick up to 5 jobs that best fit their background, ordered best fit first. Only use what's actually in the listing -- never invent detail it doesn't contain.
Respond with ONLY strict JSON, no markdown: {"picks": [{"index": <option number>, "reason": "<one sentence tailored to their background>"}]}`

  const profileLine = [
    candidate.current_title ? `Current title: ${candidate.current_title}` : '',
    candidate.skills.length ? `Skills: ${candidate.skills.join(', ')}` : '',
    candidate.education ? `Education: ${candidate.education}` : '',
    candidate.experience_years != null ? `Experience: ${candidate.experience_years} years` : '',
    feedbackHint ? `Based on past feedback, ${feedbackHint}` : '',
  ].filter(Boolean).join('\n')

  const listing = jobs.map(listingLine).join('\n')
  const result = await complete('deepedge_job_recommendations', system, `${profileLine}\n\nOpen jobs:\n${listing}`, 600)
  if (!result.ok) return null
  return parsePicks(result.text, jobs)
}

/**
 * (2) Based on previously applied jobs -- same live-ranking posture, but
 * the context is the candidate's own application history instead of
 * their static profile fields. Returns null (not an empty list) when
 * they haven't applied to anything yet, so the caller can skip the
 * section entirely rather than show it empty. feedbackHint: see (1).
 */
export async function recommendJobsFromApplicationHistory(
  appliedJobs: { title: string; skills_required: string[] }[],
  jobs: JobOption[],
  feedbackHint?: string | null
): Promise<JobPick[] | null> {
  if (jobs.length < 2 || appliedJobs.length === 0) return null

  const system = `You recommend job openings on DeepEdge to a candidate based on the jobs they've previously applied to -- infer what they're looking for from the pattern (role type, skills, seniority) across those applications. You'll be given their past applications and a numbered list of other open jobs. Pick up to 5 jobs similar in kind to what they've applied to before, ordered best fit first. Only use what's actually in the listing -- never invent detail it doesn't contain.
Respond with ONLY strict JSON, no markdown: {"picks": [{"index": <option number>, "reason": "<one sentence tying it back to their application pattern>"}]}`

  const history = appliedJobs
    .map((j) => `- ${j.title}${j.skills_required.length ? ` (${j.skills_required.join(', ')})` : ''}`)
    .join('\n')
  const hintLine = feedbackHint ? `\n\nBased on past feedback, ${feedbackHint}` : ''
  const listing = jobs.map(listingLine).join('\n')
  const result = await complete('deepedge_job_recommendations', system, `Previously applied to:\n${history}${hintLine}\n\nOther open jobs:\n${listing}`, 600)
  if (!result.ok) return null
  return parsePicks(result.text, jobs)
}

const FEEDBACK_REASON_LABEL: Record<string, string> = {
  not_relevant: 'not the right seniority/type',
  already_applied: 'roles like ones already applied elsewhere',
  wrong_fit: 'wrong location/remote or compensation',
}

/**
 * Phase 2 of the recommendation-feedback loop (125): summarizes a
 * candidate's own recent negative feedback into a short prompt hint.
 * Gated on >=3 events -- below that, one data point is noise, not a
 * pattern. Pure function over already-fetched rows (this module never
 * touches Supabase directly, matching its existing convention of
 * receiving data as params); the caller queries
 * job_recommendation_feedback and passes the rows in.
 */
export function buildFeedbackHint(feedbackRows: { feedback: string }[]): string | null {
  const negative = feedbackRows.filter((r) => r.feedback !== 'helpful')
  if (negative.length < 3) return null

  const counts = new Map<string, number>()
  for (const row of negative) {
    counts.set(row.feedback, (counts.get(row.feedback) || 0) + 1)
  }
  const topReasons = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason]) => FEEDBACK_REASON_LABEL[reason])
    .filter(Boolean)

  if (topReasons.length === 0) return null
  return `this candidate has previously marked recommendations down for: ${topReasons.join(', ')} -- avoid recommending similar roles unless they're otherwise a very strong match.`
}

function salaryRangesOverlap(aMin: number | null, aMax: number | null, bMin: number | null, bMax: number | null) {
  if (aMin == null && aMax == null) return null
  if (bMin == null && bMax == null) return null
  const lo1 = aMin ?? -Infinity, hi1 = aMax ?? Infinity
  const lo2 = bMin ?? -Infinity, hi2 = bMax ?? Infinity
  return lo1 <= hi2 && lo2 <= hi1
}

/**
 * (3) Based on job search preferences -- deliberately deterministic, not
 * an LLM call: every input here is a literal structured field
 * (remote_type, salary range, relocation, skills), so the honest
 * explanation is exactly which of those matched, not an AI guess about
 * fields it can already compare directly. Same reasoning as
 * explainPersonMatch() (AI-moat explainable-search work).
 */
export function matchJobsToPreferences(candidate: CandidateProfile, jobs: JobOption[]): JobPick[] {
  const scored = jobs.map((job) => {
    const reasons: string[] = []
    let score = 0

    if (candidate.remote_preference && candidate.remote_preference !== 'flexible' && job.remote_type === candidate.remote_preference) {
      reasons.push(`${job.remote_type} — matches your work-location preference`)
      score += 1
    }

    const salaryOverlap = salaryRangesOverlap(candidate.expected_salary_min, candidate.expected_salary_max, job.salary_min, job.salary_max)
    if (salaryOverlap) {
      reasons.push('Salary range overlaps your expectations')
      score += 1
    }

    if (candidate.skills.length && job.skills_required.length) {
      const candidateSkillsLower = new Set(candidate.skills.map((s) => s.toLowerCase()))
      const matched = job.skills_required.filter((s) => candidateSkillsLower.has(s.toLowerCase()))
      if (matched.length > 0) {
        reasons.push(`${matched.length}/${job.skills_required.length} required skills you have`)
        score += matched.length / job.skills_required.length
      }
    }

    if (candidate.willing_to_relocate === false && job.remote_type === 'onsite' && candidate.remote_preference && candidate.remote_preference !== 'onsite') {
      // Explicit mismatch -- not a positive signal, no reason added, no score bump.
    } else if (candidate.willing_to_relocate === true) {
      reasons.push('You indicated willingness to relocate')
      score += 0.25
    }

    return { job, reasons, score }
  })

  return scored
    .filter((s) => s.score >= 1 && s.reasons.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => ({ job: s.job, reason: s.reasons.join(' · ') }))
}

/**
 * (4) Jobs where you'd be a top candidate -- also deterministic:
 * compares the candidate's own verifiable signals (experience surplus,
 * skills overlap, Verified Expert status) against the job's stated
 * requirements, plus applications_count (already a real jobs column) as
 * a scarcity signal -- fewer existing applicants and a strong fit is a
 * genuinely better shot at standing out, not something an LLM should be
 * asked to estimate when the real numbers are already on hand.
 */
export function findTopCandidateJobs(
  candidate: CandidateProfile,
  isVerifiedExpert: boolean,
  jobs: JobOption[]
): JobPick[] {
  const scored = jobs.map((job) => {
    const reasons: string[] = []
    let score = 0
    let disqualified = false

    if (job.experience_min != null) {
      if (candidate.experience_years == null || candidate.experience_years < job.experience_min) {
        disqualified = true
      } else {
        const surplus = candidate.experience_years - job.experience_min
        reasons.push(surplus > 0 ? `You exceed the ${job.experience_min}+ yr requirement (${candidate.experience_years} yrs)` : `You meet the ${job.experience_min}+ yr requirement`)
        score += Math.min(surplus, 5) * 0.2
      }
    }

    let skillsOverlapPct = 1
    if (job.skills_required.length > 0) {
      const candidateSkillsLower = new Set(candidate.skills.map((s) => s.toLowerCase()))
      const matched = job.skills_required.filter((s) => candidateSkillsLower.has(s.toLowerCase()))
      skillsOverlapPct = matched.length / job.skills_required.length
      if (skillsOverlapPct >= 0.5) {
        reasons.push(`${matched.length}/${job.skills_required.length} required skills you have`)
        score += skillsOverlapPct
      } else {
        disqualified = true
      }
    }

    if (isVerifiedExpert) {
      reasons.push('Verified Expert')
      score += 0.5
    }

    if (job.applications_count != null && job.applications_count <= 5) {
      reasons.push(job.applications_count === 0 ? 'No applicants yet' : `Only ${job.applications_count} applicant${job.applications_count === 1 ? '' : 's'} so far`)
      score += 0.5
    }

    return { job, reasons, score, disqualified }
  })

  return scored
    .filter((s) => !s.disqualified && s.reasons.length >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => ({ job: s.job, reason: s.reasons.join(' · ') }))
}
