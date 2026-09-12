import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, getUserIdByEmail, grantActiveSubscriptionTier } from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
}

/**
 * Skillmeet.ai comparison round, item 3 (151): a candidate who actually
 * reached the interview stage can share a real question, which persists
 * to interview_question_logs -- the real-application-tie RLS is the
 * enforcement (mirrors company_reviews' shape), not just the UI hiding
 * the form.
 */
test('a candidate at interview stage can share a real interview question, which persists and is readable by others', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')
  await dismissGuidedTourIfShown(employerPage)

  const jobTitle = `E2E Question Sharing Job ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Own our real-time bidding infrastructure.')
  await employerPage.locator('#skills_required').fill('Distributed Systems')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')
  await dismissGuidedTourIfShown(candidatePage)

  await candidatePage.goto(`/jobs/${jobId}/apply`)
  await candidatePage.locator('#cover_letter').fill('Applying to exercise interview-question sharing.')
  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)

  // Not at 'interview' yet -- the sharing form must not appear.
  await expect(candidatePage.getByText('Share an interview question you were asked')).not.toBeVisible()

  await employerPage.goto(`/employer/jobs/${jobId}/applications`)
  await employerPage.locator('select[name="status"]').selectOption('interview')
  await employerPage.getByRole('button', { name: 'Update' }).click()
  await employerPage.waitForURL(/\/employer\/jobs\//)

  await candidatePage.goto('/dashboard/applications')
  const questionText = `E2E real question ${Date.now()}: Design a rate limiter for a multi-tenant API`
  await candidatePage.getByText('Share an interview question you were asked').click()
  await candidatePage.locator('textarea[name="question_text"]').fill(questionText)
  await candidatePage.getByRole('button', { name: 'Submit' }).click()
  await candidatePage.waitForURL(/question_submitted=1/)
  await expect(candidatePage.getByText('Thanks -- your question was shared')).toBeVisible()

  // Persisted and readable -- confirms the RLS INSERT policy actually
  // allowed it (not just the app pretending to succeed).
  const jobRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${jobId}&select=company_id`, { headers: restHeaders() })
  const [job] = await jobRes.json()
  const logRes = await fetch(
    `${SUPABASE_URL}/rest/v1/interview_question_logs?company_id=eq.${job.company_id}&question_text=eq.${encodeURIComponent(questionText)}`,
    { headers: restHeaders() }
  )
  const logs = await logRes.json()
  expect(logs.length).toBe(1)

  // The AI interview-prep endpoint now sees this real corpus for the
  // same company and still returns real, non-empty output (interview-
  // prep.ts's realQuestions branch, 151).
  const prepRes = await candidatePage.request.post('/api/applications/interview-prep', {
    data: { application_id: await getApplicationId(candidatePage, jobId) },
  })
  expect(prepRes.ok()).toBeTruthy()
  const prepBody = await prepRes.json()
  expect(prepBody.questions?.length).toBeGreaterThan(0)

  await candidateCtx.close()
  await employerCtx.close()
})

async function getApplicationId(page: import('@playwright/test').Page, jobId: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/applications?job_id=eq.${jobId}&select=id`, { headers: restHeaders() })
  const [application] = await res.json()
  return application.id
}
