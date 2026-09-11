import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { generateMarketIntelligenceReport } from '@/lib/market-intelligence'
import { NextResponse } from 'next/server'

/**
 * Manual "Generate now" trigger for the market-intelligence report --
 * same underlying generateMarketIntelligenceReport() the periodic timer
 * in instrumentation.ts calls every 24h, exposed here so an admin isn't
 * stuck waiting a full day for the first report, and so this path can be
 * exercised deterministically in e2e tests without waiting on the timer.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  await generateMarketIntelligenceReport()

  return NextResponse.redirect(absoluteUrl('/admin/market-intelligence'))
}
