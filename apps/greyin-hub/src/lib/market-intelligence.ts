import { complete } from './llm/client'
import { createServiceClient } from './supabase/service'

/**
 * AI enhancement (Phase C3, "11 new AI enhancements" plan) -- the
 * admin-only, platform-wide moat item. Unlike C1/C2 (live/on-demand off
 * one user's own data), this aggregates over the WHOLE platform, so it's
 * generated on a schedule by a timer (see instrumentation.ts's second
 * interval) rather than per admin page view. compute_market_intelligence_stats()
 * does the actual aggregation in plain SQL (skill demand, hiring
 * velocity, salary trends); this function's only job is to turn that
 * jsonb into a short narrative via one complete() call, then store both.
 */
export async function generateMarketIntelligenceReport(): Promise<void> {
  const service = createServiceClient()

  const { data: stats, error: statsError } = await service.rpc('compute_market_intelligence_stats')
  if (statsError || !stats) {
    console.error('generateMarketIntelligenceReport: failed to compute stats:', statsError)
    return
  }

  const lines = `Platform stats (JSON):\n${JSON.stringify(stats, null, 2)}`

  const system = `You write a short market-intelligence briefing for a hiring platform's internal admin team, based on real aggregate platform stats (top in-demand skills, hiring velocity, salary trends). Only state what's actually given in the numbers -- never invent a specific company, employer, or candidate. 2-3 short paragraphs covering: what's in demand, whether hiring is speeding up or slowing down, and any notable salary pattern. Respond with ONLY the briefing, no preamble, no markdown headers.`

  const result = await complete('greyin_hub_market_intelligence', system, lines, 500)
  const reportText = result.ok ? result.text.trim() : 'AI narrative unavailable this cycle -- see raw stats below.'

  const { error: insertError } = await service.from('market_intelligence_reports').insert({
    report_text: reportText,
    raw_stats: stats,
  })
  if (insertError) {
    console.error('generateMarketIntelligenceReport: failed to store report:', insertError)
  }
}
