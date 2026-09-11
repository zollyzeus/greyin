import { createServiceClient } from '@/lib/supabase/service'
import { generateMarketIntelligenceReport } from '@/lib/market-intelligence'

/**
 * Next.js calls register() once when a new server instance boots (not
 * per-request) -- same pattern as greymatters-blog's/saltnpepper-
 * community's own instrumentation.ts. Guarded to the nodejs runtime
 * because this file also gets loaded when compiling for the edge
 * runtime, where setInterval/the service-role client don't apply.
 *
 * Refreshes platform_score_means (122) -- the slow-moving global
 * shrinkage-target statistics greyin_scores now reads from a cache
 * instead of recomputing on every read (the fix for a real scalability
 * defect: the old view rescanned verified_outcomes/reputation_events/
 * ai_quality_scores/profiles/peer_project_ratings in full on every
 * single lookup, confirmed via EXPLAIN ANALYZE). Greyin Hub owns this
 * timer, not any one pillar app, since the stats it refreshes are
 * genuinely platform-wide (same "no pillar affiliation of its own"
 * rationale as the admin/llm, admin/threshold-votes, admin/bias-audit
 * panels already living here) -- per-user inputs stay instantly live
 * via triggers on the evidence tables themselves; only this global mean
 * is refreshed on a schedule, since an hour of staleness on a shrinkage
 * target is a complete non-issue.
 *
 * Single replica today (deployment/frontend-stack.yml) -- this timer
 * would double up if that ever changes without adding real
 * coordination (e.g. an advisory lock). Acceptable for now: a duplicate
 * refresh tick is wasteful, not harmful -- refresh_platform_score_means()
 * is a plain idempotent UPDATE of one singleton row.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const TICK_MS = 30 * 60_000

  setInterval(() => {
    ;(async () => {
      try {
        const supabase = createServiceClient()
        const { error } = await supabase.rpc('refresh_platform_score_means')
        if (error) console.error('Periodic platform_score_means refresh failed:', error)
      } catch (error) {
        console.error('Periodic platform_score_means refresh failed:', error)
      }
    })()
  }, TICK_MS)

  // Market-intelligence report (Phase C3, 130/131) -- a much slower-moving,
  // whole-platform aggregate than the shrinkage means above, so it gets its
  // own, much longer interval on this same timer file rather than a second
  // file (per the approved plan's own explicit instruction). A "Generate
  // now" admin button (api/admin/market-intelligence/generate) calls the
  // exact same function on demand, so a slow first tick never blocks an
  // admin from seeing a report immediately after this feature ships.
  const MARKET_INTEL_TICK_MS = 24 * 60 * 60_000

  setInterval(() => {
    generateMarketIntelligenceReport().catch((error) => {
      console.error('Periodic market-intelligence report generation failed:', error)
    })
  }, MARKET_INTEL_TICK_MS)
}
