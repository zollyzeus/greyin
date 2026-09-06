import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  }
}

/**
 * UI/UX elevation plan, Phase 1 slice (2026-09-06): the Greyin Score --
 * this platform's actual product signal per the pitch deck -- was
 * previously visible nowhere in persistent chrome, only in a contextual
 * "Verified Expert" banner on DeepEdge's own dashboard. Added a small
 * badge next to the notification bell in all 6 dashboard bars, gated on
 * `greyin_scores.greyin_score != null` -- the view's own design
 * deliberately returns NULL (not 0) for a zero-evidence profile, so a
 * fresh signup must show no badge at all, not "Score 0".
 *
 * Spot-checked on 2 apps (DeepEdge, the reference app for this plan, and
 * Salt & Pepper, whose `reputation_events` channel is the cheapest real
 * evidence to fabricate via REST) rather than all 6 -- the badge markup
 * is identical apart from each app's own accent color, already covered
 * by this suite's established "pilot + one cross-app spot-check"
 * convention (see notification-bell.spec.ts).
 *
 * 2026-09-06 fix: the Salt & Pepper test originally called
 * signUpSaltNPepper(page, cleanup) and login(page, member, '/dashboard')
 * with no explicit baseUrl/absolute expectedUrl. Both default to a bare
 * relative path against the *cross-platform project's own default
 * baseURL* (DeepEdge's), not the app the helper name implies -- this
 * spec's own DeepEdge test happened to "pass" only because DeepEdge is
 * that default. The Salt & Pepper test actually filled Salt & Pepper's
 * test data into DeepEdge's signup form (confirmed via the failure's own
 * page snapshot: DeepEdge's role-radio-button form, not Salt & Pepper's
 * "Request access" form), so the button it waited for never existed --
 * a real bug in this test, not a flake, not an app or infra issue. Same
 * bug class already documented and fixed once before in this exact file
 * area (see dashboard-activity-and-gig-quality.spec.ts's own account);
 * missed here because that fix wasn't generalized into a lint/convention
 * check. Fixed the same way every other cross-platform spec calling
 * signUpSaltNPepper already does: explicit baseUrl on signUp, explicit
 * absolute expectedUrl + baseUrl on login.
 */
test('DeepEdge: no score badge for a fresh zero-evidence signup, appears once real evidence exists', async ({ page, cleanup }) => {
  const candidate = await signUpDeepEdge(page, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  const candidateId = await getUserIdByEmail(candidate.email)
  await login(page, candidate, 'https://deepedge.greyin.net/dashboard', 'https://deepedge.greyin.net')

  const badge = page.getByTestId('dashboard-score-badge')
  await expect(badge).not.toBeVisible()

  // Fabricate one real evidence point via Salt & Pepper's channel --
  // greyin_scores' own saltnpepper_raw CTE only counts
  // reputation_events rows with event_type='project_upvoted' (confirmed
  // by reading the current view definition, migration 105 --
  // event_type is NOT a free-form filter), and feeds the same global
  // greyin_scores view regardless of which app is viewing it. Cheaper
  // than a full StackWorks verified-outcome or FlexPro review flow for
  // exercising the same badge.
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/reputation_events`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ user_id: candidateId, event_type: 'project_upvoted', points: 80 }),
  })
  expect(insertRes.ok).toBeTruthy()

  await page.reload({ waitUntil: 'networkidle' })
  await expect(badge).toBeVisible()
  await expect(badge).toContainText(/Score \d+/)
})

test('Salt & Pepper: score badge reflects the same shared greyin_scores view', async ({ page, cleanup }) => {
  const member = await signUpSaltNPepper(page, cleanup, 'https://saltnpepper.greyin.net')
  const memberId = await getUserIdByEmail(member.email)
  await login(page, member, 'https://saltnpepper.greyin.net/dashboard', 'https://saltnpepper.greyin.net')

  const badge = page.getByTestId('dashboard-score-badge')
  await expect(badge).not.toBeVisible()

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/reputation_events`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ user_id: memberId, event_type: 'project_upvoted', points: 80 }),
  })
  expect(insertRes.ok).toBeTruthy()

  await page.reload({ waitUntil: 'networkidle' })
  await expect(badge).toBeVisible()
  await expect(badge).toContainText(/Score \d+/)
})
