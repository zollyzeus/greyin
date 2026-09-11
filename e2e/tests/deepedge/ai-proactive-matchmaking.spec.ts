import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, grantActiveSubscriptionTier, setCandidateProfile, getJobIdByTitle } from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function getNotifications(userId: string, type: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${userId}&type=eq.${type}`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  })
  return res.json()
}

/**
 * AI enhancement (Phase D3, "11 new AI enhancements" plan): two-sided
 * proactive matchmaking. Re-scoped from the plan's original "needs a new
 * employer criteria-capture step" concern: an OPEN job's own
 * skills_required/experience_min already IS that criteria, so no new
 * capture UI was built -- see 134_proactive_matchmaking.sql's own header
 * comment. Both sweep functions are lazy, page-load-triggered (same
 * shape as sweep_salary_trend_alerts, 063), so this test drives real
 * page loads rather than calling the RPCs directly, to exercise the
 * actual wiring in apps/deepedge/src/app/dashboard/page.tsx and
 * employer/dashboard/page.tsx, not just the SQL in isolation.
 */
test('a real open-job/candidate match notifies both the candidate and the employer, without either side searching', async ({ browser, cleanup }) => {
  test.setTimeout(120_000)
  const suffix = Date.now()

  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  const employerId = await getUserIdByEmail(employer.email)
  await grantActiveSubscriptionTier(employerId, 'basic')
  await login(employerPage, employer, '/employer/dashboard')
  await dismissGuidedTourIfShown(employerPage)

  const jobTitle = `E2E Proactive Match Job ${suffix}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Seeded for the proactive-matchmaking e2e spec.')
  await employerPage.locator('#remote_type').selectOption('remote')
  await employerPage.locator('#experience_min').fill('5')
  await employerPage.locator('#skills_required').fill('Kubernetes, Go')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)

  // Matching candidate: full skills overlap, well above the experience
  // gate, never applies.
  const matchCtx = await browser.newContext()
  const matchPage = await matchCtx.newPage()
  const matchingCandidate = await signUpDeepEdge(matchPage, 'candidate', cleanup, 10)
  const matchingCandidateId = await getUserIdByEmail(matchingCandidate.email)
  await setCandidateProfile(matchingCandidateId, { skills: ['Kubernetes', 'Go', 'Terraform'] })

  // Non-matching candidate: unrelated skills, real signal this doesn't
  // fire indiscriminately for every candidate who logs in.
  const nonMatchCtx = await browser.newContext()
  const nonMatchPage = await nonMatchCtx.newPage()
  const nonMatchingCandidate = await signUpDeepEdge(nonMatchPage, 'candidate', cleanup, 10)
  const nonMatchingCandidateId = await getUserIdByEmail(nonMatchingCandidate.email)
  await setCandidateProfile(nonMatchingCandidateId, { skills: ['Photoshop', 'Illustrator'] })

  // Candidate-side sweep fires on a real /dashboard page load.
  await login(matchPage, matchingCandidate, '/dashboard')
  const matchNotifications = await getNotifications(matchingCandidateId, 'proactive_job_match')
  expect(matchNotifications.some((n: any) => n.link === `/jobs/${jobId}`)).toBe(true)

  // Reloading /dashboard again must NOT duplicate the notification --
  // the dedup ledger (proactive_match_notifications) should stop it.
  await matchPage.reload({ waitUntil: 'networkidle' })
  const matchNotificationsAfterReload = await getNotifications(matchingCandidateId, 'proactive_job_match')
  expect(matchNotificationsAfterReload.filter((n: any) => n.link === `/jobs/${jobId}`).length).toBe(1)

  await login(nonMatchPage, nonMatchingCandidate, '/dashboard')
  const nonMatchNotifications = await getNotifications(nonMatchingCandidateId, 'proactive_job_match')
  expect(nonMatchNotifications.some((n: any) => n.link === `/jobs/${jobId}`)).toBe(false)

  // Employer-side sweep fires on a real /employer/dashboard page load --
  // a fresh context so this is a genuinely new page load, not a stale
  // server-rendered copy from the post-job flow above.
  const employerCtx2 = await browser.newContext()
  const employerPage2 = await employerCtx2.newPage()
  await login(employerPage2, employer, '/employer/dashboard')
  const employerNotifications = await getNotifications(employerId, 'proactive_candidate_match')
  const jobNotification = employerNotifications.find((n: any) => n.link === `/employer/jobs/${jobId}`)
  expect(jobNotification).toBeTruthy()
  expect(jobNotification.body).toContain('1 candidate')

  await employerCtx.close()
  await employerCtx2.close()
  await matchCtx.close()
  await nonMatchCtx.close()
})
