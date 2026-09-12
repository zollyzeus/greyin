import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, grantActiveSubscription, setYearsExperience } from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
}

/**
 * Skillmeet.ai comparison round, item 2 (150): no per-viewer log existed
 * before this -- dashboard's "Profile Views" tile was hardcoded 0 since
 * the 2026-09-05 integrity audit explicitly flagged no backing counter
 * existed. Free tier gets a real count; "who viewed you" is gated behind
 * a new candidate_subscriptions row (granted here directly, same as
 * every other subscription-gated spec on this page, rather than driving
 * a real Razorpay checkout).
 */
test('a real profile view is counted for free, and viewer identity only appears with an active Profile Insights subscription', async ({ browser, cleanup }) => {
  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')
  await dismissGuidedTourIfShown(candidatePage)
  const candidateId = await getUserIdByEmail(candidate.email)
  await setYearsExperience(candidateId, 15)

  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await login(employerPage, employer, '/employer/dashboard')
  await dismissGuidedTourIfShown(employerPage)
  const employerId = await getUserIdByEmail(employer.email)
  await grantActiveSubscription(employerId)

  const companyRes = await fetch(`${SUPABASE_URL}/rest/v1/companies?user_id=eq.${employerId}&select=id,name`, { headers: restHeaders() })
  const [company] = await companyRes.json()

  // A real employer view of the candidate's profile -- this is what
  // record_profile_view() (150) records.
  await employerPage.goto(`/candidates/${candidateId}`)
  await expect(employerPage.getByText(`${candidate.firstName} ${candidate.lastName}`)).toBeVisible()

  await candidatePage.goto('/dashboard')
  const viewsTile = candidatePage.locator('div.bg-white.rounded-lg.shadow.p-6').filter({ hasText: 'Profile Views (7d)' })
  await expect(viewsTile).toBeVisible()
  await expect(viewsTile.getByText(/^[1-9]\d*$/)).toBeVisible()

  // Free tier: count shown, teaser CTA, no identity.
  await expect(candidatePage.getByText(/employer.*viewed your profile this week/)).toBeVisible()
  await expect(candidatePage.getByRole('link', { name: 'See who viewed you →' })).toBeVisible()
  if (company?.name) {
    await expect(candidatePage.getByText(company.name)).not.toBeVisible()
  }

  // Grant Profile Insights directly (same pattern as grantActiveSubscription
  // for the employer side) rather than driving a real Razorpay checkout.
  // No explicit cleanup tracking needed -- candidate_subscriptions.user_id
  // cascades on the candidate's own auth.users delete (150).
  const grantRes = await fetch(`${SUPABASE_URL}/rest/v1/candidate_subscriptions`, {
    method: 'POST',
    headers: { ...restHeaders(), Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: candidateId,
      status: 'active',
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  })
  expect(grantRes.ok).toBeTruthy()

  await candidatePage.goto('/dashboard')
  await expect(candidatePage.getByRole('link', { name: 'See who viewed you →' })).not.toBeVisible()
  if (company?.name) {
    await expect(candidatePage.getByText(company.name)).toBeVisible()
  }

  await candidateCtx.close()
  await employerCtx.close()
})
