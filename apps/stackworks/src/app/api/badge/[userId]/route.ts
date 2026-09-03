import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

/**
 * Public, unauthenticated SVG badge -- addresses the competitive audit's
 * top-ranked gap (Aug 2026): StackWorks's verified track record is the
 * real differentiator over GitHub's contribution graph, but it was
 * locked in-app, unlike GitHub's famously portable, embeddable badge.
 * Deliberately exposes only three fields (name, verified outcome
 * count, Greyin Score) via the service-role client -- no other
 * profile/candidate data goes through this route. Cacheable and
 * hotlinkable from a resume or LinkedIn profile, same as
 * shields.io/GitHub-style badges.
 */
function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!))
}

function renderBadge(name: string, verifiedCount: number, score: number | null) {
  const label = escapeXml(name)
  const scoreText = score != null ? String(score) : '—'
  const width = 300
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="60" viewBox="0 0 ${width} 60" role="img" aria-label="StackWorks verified track record for ${label}">
  <rect width="${width}" height="60" rx="8" fill="#0f172a"/>
  <text x="14" y="22" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12" fill="#5eead4" font-weight="700">STACKWORKS VERIFIED</text>
  <text x="14" y="42" font-family="ui-sans-serif,system-ui,sans-serif" font-size="13" fill="#e2e8f0">${label}</text>
  <text x="14" y="55" font-family="ui-sans-serif,system-ui,sans-serif" font-size="10" fill="#94a3b8">${verifiedCount} verified outcome${verifiedCount === 1 ? '' : 's'}</text>
  <rect x="${width - 62}" y="14" width="48" height="32" rx="6" fill="#134e4a"/>
  <text x="${width - 38}" y="35" font-family="ui-sans-serif,system-ui,sans-serif" font-size="16" fill="#5eead4" font-weight="700" text-anchor="middle">${scoreText}</text>
</svg>`
}

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = createServiceClient()

  const { data: person } = await supabase
    .from('platform_people_index')
    .select('full_name, verified_outcomes_count, greyin_score')
    .eq('user_id', userId)
    .maybeSingle()

  const svg = person
    ? renderBadge(person.full_name || 'Greyin member', person.verified_outcomes_count || 0, person.greyin_score)
    : renderBadge('Unknown member', 0, null)

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
