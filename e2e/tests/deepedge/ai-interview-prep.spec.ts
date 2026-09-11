import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, getUserIdByEmail, grantActiveSubscriptionTier } from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

/**
 * Phase B1 of the "11 new AI enhancements" plan (2026-09-07): the
 * interview-prep assist only appears once a real application reaches the
 * 'interview' status (applications.status), driven here through the real
 * employer status-update UI, not a direct DB write -- confirms the whole
 * real path (employer marks interview -> candidate sees the assist), not
 * just the flag check in isolation.
 */
test('interview prep assist appears only once an application reaches interview status, and returns real questions', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')
  await dismissGuidedTourIfShown(employerPage)

  const jobTitle = `E2E Interview Prep Job ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Own our Kubernetes platform and CI/CD pipeline end to end.')
  await employerPage.locator('#skills_required').fill('Kubernetes, CI/CD')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')
  await dismissGuidedTourIfShown(candidatePage)

  await candidatePage.goto(`/jobs/${jobId}/apply`)
  await candidatePage.locator('#cover_letter').fill('Applying to exercise the interview-prep assist.')
  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)

  // Not at 'interview' yet -- the assist must not appear.
  await expect(candidatePage.getByRole('button', { name: 'AI interview prep' })).not.toBeVisible()

  await employerPage.goto(`/employer/jobs/${jobId}/applications`)
  await employerPage.locator('select[name="status"]').selectOption('interview')
  await employerPage.getByRole('button', { name: 'Update' }).click()
  await employerPage.waitForURL(/\/employer\/jobs\//)

  await candidatePage.goto('/dashboard/applications')
  const assistButton = candidatePage.getByRole('button', { name: 'AI interview prep' })
  await expect(assistButton).toBeVisible()
  await assistButton.click()
  await expect(candidatePage.locator('p.whitespace-pre-line')).not.toHaveText('', { timeout: 30_000 })

  await candidateCtx.close()
  await employerCtx.close()
})
