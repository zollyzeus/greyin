import { complete } from './llm/client'
import { createServiceClient } from './supabase/service'

const RELATIONSHIP_LABEL: Record<string, string> = {
  in_platform_task: 'Worked together on a Greyin project/gig',
  ex_colleague: 'Former colleague',
  current_colleague: 'Current colleague',
  other: 'Other professional relationship',
}

function buildPrompt(entries: { relationship: string; body: string }[]) {
  const system = `You are helping an employer on DeepEdge review multiple professional references for a job candidate. You will be given each referee's stated relationship to the candidate and their written reference response. Decide whether the references are broadly consistent with each other (similar overall impression, no contradictory factual claims) or whether there are notable differences worth the employer following up on (e.g. conflicting characterizations, contradictory facts, a clearly negative outlier among otherwise positive references). Only use what the responses actually say -- never invent detail they don't contain.

Respond in exactly this format:
CONSISTENCY: <consistent|notable_differences>
SUMMARY: <3-5 sentence neutral synthesis of what the references say in common>
NOTES: <if notable_differences, 1-3 sentences on what differs and why the employer may want to follow up; if consistent, write exactly "None.">`

  const prompt = entries
    .map((e, i) => `Reference ${i + 1} (${RELATIONSHIP_LABEL[e.relationship] || e.relationship}):\n${e.body}`)
    .join('\n\n')

  return { system, prompt }
}

function parseReport(text: string): { consistency: 'consistent' | 'notable_differences'; summary: string; notes: string } | null {
  const consistencyMatch = text.match(/CONSISTENCY:\s*(consistent|notable_differences)/i)
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?:\nNOTES:|$)/i)
  const notesMatch = text.match(/NOTES:\s*([\s\S]*)/i)
  if (!consistencyMatch || !summaryMatch) return null
  return {
    consistency: consistencyMatch[1].toLowerCase() as 'consistent' | 'notable_differences',
    summary: summaryMatch[1].trim(),
    notes: notesMatch ? notesMatch[1].trim() : '',
  }
}

/**
 * Called after a reference response is submitted (api/references/respond).
 * Uses the service client because synthesizing requires reading every
 * referee's response for this (candidate, employer) pair -- each response
 * is only individually RLS-visible to its own responder and the requesting
 * employer, not to a randomly-chosen responder's own request-scoped
 * client. Best-effort like runPostQualityCheck: never throws, a failure
 * here must not block the response submission that triggered it.
 */
export async function runReferenceSynthesisIfDue(candidateId: string, requestedBy: string): Promise<void> {
  const service = createServiceClient()

  const { data: refRows } = await service
    .from('professional_references')
    .select('id, relationship_type')
    .eq('candidate_id', candidateId)
  if (!refRows || refRows.length === 0) return

  const referenceIds = refRows.map((r) => r.id)
  const { data: reqRows } = await service
    .from('reference_requests')
    .select('id, reference_id')
    .eq('requested_by', requestedBy)
    .in('reference_id', referenceIds)
  if (!reqRows || reqRows.length === 0) return

  const requestIds = reqRows.map((r) => r.id)
  const { data: respRows } = await service
    .from('reference_responses')
    .select('request_id, body')
    .in('request_id', requestIds)
  if (!respRows || respRows.length < 2) return

  const relationshipByRequestId = new Map(
    reqRows.map((r) => [r.id, refRows.find((ref) => ref.id === r.reference_id)?.relationship_type || 'other'])
  )
  const entries = respRows.map((r) => ({
    relationship: relationshipByRequestId.get(r.request_id) || 'other',
    body: r.body,
  }))

  const { system, prompt } = buildPrompt(entries)
  const result = await complete('deepedge_reference_synthesis', system, prompt)
  if (!result.ok) return

  const parsed = parseReport(result.text)
  if (!parsed) return

  await service.from('ai_reference_reports').upsert(
    {
      candidate_id: candidateId,
      requested_by: requestedBy,
      response_count: respRows.length,
      consistency: parsed.consistency,
      summary: parsed.summary,
      notes: parsed.notes || null,
      provider: result.provider,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'candidate_id,requested_by' }
  )
}
