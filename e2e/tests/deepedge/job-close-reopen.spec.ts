import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle } from '../../utils/admin'

/**
 * Emergent gap audit item #1 ("most-impactful known issue"): the only
 * route that ever closed a job was admin-only (api/admin/jobs/close),
 * and no reopen route existed at all, admin or otherwise. Covers the
 * new self-service route end to end -- close removes the job from the
 * public /jobs listing (status='open' filter) and notifies a candidate
 * with a still-open application, reopen brings it back.
 */
test('an employer can close and reopen their own job without admin help', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `E2E Close Reopen Test Role ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise self-service close/reopen end to end.')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)

  // A candidate applies first, so there's someone real to notify on close.
  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')
  await candidatePage.goto(`/jobs/${jobId}/apply`)
  await candidatePage.locator('#cover_letter').fill('I am an automated test candidate.')
  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)

  await employerPage.goto('/jobs')
  await expect(employerPage.getByText(jobTitle)).toBeVisible()

  await employerPage.goto('/employer/dashboard')
  const dashboardRow = employerPage.locator('div.border.border-gray-200.rounded-lg').filter({ hasText: jobTitle })
  await expect(dashboardRow).toHaveCount(1)
  await expect(dashboardRow.getByText('open', { exact: true })).toBeVisible()
  await dashboardRow.getByRole('button', { name: 'Close listing' }).click()
  await employerPage.waitForURL('/employer/dashboard')

  const closedRow = employerPage.locator('div.border.border-gray-200.rounded-lg').filter({ hasText: jobTitle })
  await expect(closedRow.getByText('closed', { exact: true })).toBeVisible()
  await expect(closedRow.getByRole('button', { name: 'Close listing' })).toHaveCount(0)
  await expect(closedRow.getByRole('button', { name: 'Reopen' })).toBeVisible()

  // Gone from the public listing once closed.
  await employerPage.goto('/jobs')
  await expect(employerPage.getByText(jobTitle)).toHaveCount(0)

  // The candidate with a still-open application is notified.
  await candidatePage.goto('/notifications')
  await expect(candidatePage.getByText('A role you applied to has closed')).toBeVisible()

  // Reopen brings it back.
  await employerPage.goto('/employer/dashboard')
  const closedRow2 = employerPage.locator('div.border.border-gray-200.rounded-lg').filter({ hasText: jobTitle })
  await closedRow2.getByRole('button', { name: 'Reopen' }).click()
  await employerPage.waitForURL('/employer/dashboard')

  await employerPage.goto('/jobs')
  await expect(employerPage.getByText(jobTitle)).toBeVisible()
})
