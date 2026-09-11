import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/site-url'
import { NextResponse } from 'next/server'

// Recommended by docs/audits/competitive-analysis/emergent_deployment_gap.md's UI/UX audit (2026-08-26,
// re-confirmed 2026-08-31 and again 2026-09-02): live e2e-suite content
// left on public feeds -- 10 "E2E AI Quality Post" + 35 "E2E Verified
// Expert Only Post" entries on GreyMatters' public blog (the visible,
// actively-worsening problem the audit flagged), plus 183 "E2E*"
// builder_projects on StackWorks (not publicly listed, since they never
// left 'idea' status, but still stale test rows in a production table).
// Manually cleared once (2026-09-02); this route exists so the next
// occurrence doesn't need a manual DB session again.
//
// "E2E " is the one consistent marker across this whole suite -- every
// test-generated title in e2e/utils/testUser.ts and every ad hoc test
// title used directly in spec files starts with it. Deliberately a title
// prefix match, not a dedicated is_test_data column: adding that column
// would mean retrofitting every insert path across 6 apps' worth of e2e
// helpers for a one-line win the existing naming convention already gives
// for free. Platform-wide (not one app's own admin) since the pollution
// spans GreyMatters' posts and StackWorks' builder_projects -- exactly
// the "genuinely cross-pillar, belongs on Hub" pattern the LLM-provider
// and eligibility-governance panels already established (2026-08-24).
const CLEANUP_TARGETS: { table: string; column: string }[] = [
  { table: 'posts', column: 'title' },
  { table: 'builder_projects', column: 'title' },
  { table: 'discussions', column: 'title' },
  { table: 'gigs', column: 'title' },
  { table: 'jobs', column: 'title' },
]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(absoluteUrl('/login?next=/admin'))
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(absoluteUrl('/dashboard'))
  }

  const results: Record<string, number> = {}
  for (const { table, column } of CLEANUP_TARGETS) {
    const { data, error } = await supabase.from(table).delete().like(column, 'E2E %').select('id')
    results[table] = error ? -1 : (data?.length ?? 0)
  }

  const totalDeleted = Object.values(results).filter((n) => n > 0).reduce((a, b) => a + b, 0)
  return NextResponse.redirect(
    absoluteUrl(`/admin?cleanup_result=${encodeURIComponent(JSON.stringify(results))}&cleanup_total=${totalDeleted}`)
  )
}
