import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, grantActiveSubscriptionTier } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

// 096: viewing a candidate's full profile (/candidates/[id]) is the one
// hiring-tier credit type wired to real enforcement this pass. 'basic'
// seeds 50 profile_view credits/mo -- pre-consume 49 directly (same
// precedent as every other subscription-grant helper here) so the test
// only needs two page loads to prove both the "still within allowance"
// and "allowance exhausted" paths.
//
// URL id is the person's own profiles.id/user_id, not candidates.id
// (candidates/[id]/page.tsx's own banner comment) -- this test was
// navigating with candidates.id, which never matched, so the page always
// 404'd before either assertion below ever ran. Fixed to use
// candidateUserId directly.
test('viewing a candidate profile is capped by the employer\'s tier credit allowance, and blocked once exhausted', async ({ browser, cleanup }) => {
  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  const candidateUserId = await getUserIdByEmail(candidate.email)
  await candidateCtx.close()

  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  const employerUserId = await getUserIdByEmail(employer.email)
  await grantActiveSubscriptionTier(employerUserId, 'basic')

  const periodStart = new Date()
  periodStart.setDate(1)
  const periodStartStr = periodStart.toISOString().slice(0, 10)

  const preConsumeRes = await fetch(`${SUPABASE_URL}/rest/v1/credit_usage?on_conflict=user_id,product,credit_type,period_start`, {
    method: 'POST',
    headers: { ...restHeaders(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: employerUserId,
      product: 'deepedge_hiring',
      credit_type: 'profile_view',
      period_start: periodStartStr,
      used_count: 49,
    }),
  })
  expect(preConsumeRes.ok).toBeTruthy()

  await login(employerPage, employer, '/employer/dashboard')

  // 50th credit -- should succeed, real profile detail renders.
  await employerPage.goto(`/candidates/${candidateUserId}`)
  await expect(employerPage.getByText(`${candidate.firstName} ${candidate.lastName}`)).toBeVisible()
  await expect(employerPage.getByText('Verified Expert')).toBeVisible()

  // 51st credit -- allowance exhausted, upgrade screen instead of the profile.
  await employerPage.goto(`/candidates/${candidateUserId}`)
  await expect(employerPage.getByText(/Out of profile views for this month/i)).toBeVisible()
  await expect(employerPage.getByText(`${candidate.firstName} ${candidate.lastName}`)).not.toBeVisible()

  await employerCtx.close()
})
