import { complete } from './llm/client'
import { createServiceClient } from './supabase/service'

/**
 * Gap-audit item #1: pre-publish content moderation. Distinct in kind from
 * reply-quality.ts's AI *quality* sweep (informational, always after the
 * fact, never blocks anything) -- this is the first feature in the
 * codebase where an LLM verdict can gate whether an insert happens at all.
 *
 * Failure-mode decision (confirmed with the user): fail-OPEN -- if the LLM
 * is unreachable/unconfigured, the post goes live immediately rather than
 * blocking a real user, but it's queued (moderation_status='pending_check')
 * for automatic re-check once the LLM is available again. A *successful*
 * BLOCK verdict still blocks the post synchronously; fail-open only covers
 * the check being unable to run at all.
 */

interface ModerationInput {
  title?: string
  body: string
}

function buildPrompt(input: ModerationInput) {
  const system = `You are a pre-publish content moderator for Salt & Pepper, a peer community
for experienced professionals. Review the content below and decide whether it
should be allowed. Block only genuine violations: harassment, hate speech,
explicit spam/scams, doxxing, or sexually explicit content. Do NOT block
content merely because it's blunt, critical, off-topic, or low-effort --
those are quality concerns, not safety ones, and are handled elsewhere.

Respond in exactly this format:
VERDICT: <ALLOW or BLOCK>
REASON: <one sentence, empty if ALLOW>`

  const prompt = [input.title ? `Title: ${input.title}` : '', `Body: ${input.body}`].filter(Boolean).join('\n')
  return { system, prompt }
}

function parseVerdict(text: string): { verdict: 'allow' | 'block'; reason: string } | null {
  const verdictMatch = text.match(/VERDICT:\s*(ALLOW|BLOCK)/i)
  if (!verdictMatch) return null
  const reasonMatch = text.match(/REASON:\s*(.*)/i)
  return {
    verdict: verdictMatch[1].toUpperCase() === 'BLOCK' ? 'block' : 'allow',
    reason: reasonMatch ? reasonMatch[1].trim() : '',
  }
}

export type ModerationOutcome =
  | { outcome: 'allow' }
  | { outcome: 'block'; reason: string }
  | { outcome: 'unavailable' }

/**
 * The real synchronous gate, called from both discussions/create and
 * discussions/[id]/reply before the insert. 'unavailable' covers a
 * disabled feature flag, no configured provider, every provider failing,
 * or an unparseable response -- all treated the same (fail-open) rather
 * than guessing at intent from a malformed answer.
 */
export async function checkModeration(input: ModerationInput): Promise<ModerationOutcome> {
  const { system, prompt } = buildPrompt(input)
  const result = await complete('saltnpepper_moderation', system, prompt, 200)
  if (!result.ok) return { outcome: 'unavailable' }

  const parsed = parseVerdict(result.text)
  if (!parsed) return { outcome: 'unavailable' }

  return parsed.verdict === 'block' ? { outcome: 'block', reason: parsed.reason } : { outcome: 'allow' }
}

/**
 * Re-checks rows the fail-open path let through while the LLM was
 * unavailable. A re-verdict of BLOCK does NOT auto-delete the post --
 * flagged for a human admin to review and, if warranted, remove via the
 * existing admin discussion-delete route (which already cascades to
 * replies). Automated retroactive takedown of already-published content
 * was deliberately not built; a person decides.
 */
export async function retryPendingModerationChecks(limit = 5): Promise<{ rechecked: number; stillPending: number }> {
  const service = createServiceClient()
  let rechecked = 0

  const { data: pendingDiscussions } = await service
    .from('discussions')
    .select('id, title, body')
    .eq('moderation_status', 'pending_check')
    .order('created_at', { ascending: true })
    .limit(limit)

  for (const d of pendingDiscussions || []) {
    const result = await checkModeration({ title: d.title, body: d.body })
    if (result.outcome === 'unavailable') continue
    await service
      .from('discussions')
      .update({ moderation_status: result.outcome === 'block' ? 'flagged_on_retry' : 'passed' })
      .eq('id', d.id)
    rechecked++
  }

  const { data: pendingReplies } = await service
    .from('discussion_replies')
    .select('id, body')
    .eq('moderation_status', 'pending_check')
    .order('created_at', { ascending: true })
    .limit(limit)

  for (const r of pendingReplies || []) {
    const result = await checkModeration({ body: r.body })
    if (result.outcome === 'unavailable') continue
    await service
      .from('discussion_replies')
      .update({ moderation_status: result.outcome === 'block' ? 'flagged_on_retry' : 'passed' })
      .eq('id', r.id)
    rechecked++
  }

  const { count: stillPendingDiscussions } = await service
    .from('discussions')
    .select('id', { count: 'exact', head: true })
    .eq('moderation_status', 'pending_check')
  const { count: stillPendingReplies } = await service
    .from('discussion_replies')
    .select('id', { count: 'exact', head: true })
    .eq('moderation_status', 'pending_check')

  return { rechecked, stillPending: (stillPendingDiscussions || 0) + (stillPendingReplies || 0) }
}

/**
 * Timer-driven counterpart, same "claim by writing last_swept_at first"
 * pattern as reply-quality.ts's runPeriodicSweepIfDue() -- reuses the same
 * llm_feature_flags.sweep_interval_minutes/last_swept_at columns (050),
 * keyed on this feature's own row instead.
 */
export async function runPeriodicModerationRetryIfDue(limit = 5): Promise<void> {
  const service = createServiceClient()

  const { data: flag } = await service
    .from('llm_feature_flags')
    .select('sweep_interval_minutes, last_swept_at')
    .eq('feature_key', 'saltnpepper_moderation')
    .maybeSingle()

  if (!flag?.sweep_interval_minutes) return

  const dueAt = flag.last_swept_at
    ? new Date(flag.last_swept_at).getTime() + flag.sweep_interval_minutes * 60_000
    : 0
  if (Date.now() < dueAt) return

  await service
    .from('llm_feature_flags')
    .update({ last_swept_at: new Date().toISOString() })
    .eq('feature_key', 'saltnpepper_moderation')

  await retryPendingModerationChecks(limit)
}
