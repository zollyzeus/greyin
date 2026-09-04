import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, grantActiveSubscriptionTier, getUserIdByEmail } from '../../utils/admin'

test('a candidate is notified when their application status changes', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `E2E Notification Role ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise application notifications.')
  await employerPage.locator('#location').fill('Remote')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')

  const jobId = await getJobIdByTitle(jobTitle)

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')
  await candidatePage.goto(`/jobs/${jobId}/apply`)
  await candidatePage.locator('#cover_letter').fill('E2E notification test candidate.')
  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)

  // The employer should have been notified of the new application too.
  await employerPage.goto('/employer/dashboard')
  await expect(employerPage.getByTitle('Notifications')).toContainText('1')

  await employerPage.goto(`/employer/jobs/${jobId}/applications`)
  await employerPage.locator('select[name="status"]').selectOption('shortlisted')
  await employerPage.getByRole('button', { name: 'Update' }).click()
  // The status-update route redirects with a ?success=1 query string --
  // an unanchored /\/applications$/ never matches it, so this always ran
  // out the full 60s timeout despite the update genuinely succeeding.
  await employerPage.waitForURL(/\/applications\?success=1/)
  await employerCtx.close()

  // /dashboard's own bell was swapped for the shared <NotificationBell />
  // (structural sync pass, 2026-09-05), which carries aria-label instead
  // of a title attribute -- /employer/dashboard above is untouched, so it
  // still uses getByTitle.
  await candidatePage.goto('/dashboard')
  await expect(candidatePage.getByLabel('Notifications')).toContainText('1')

  await candidatePage.goto('/notifications')
  await expect(candidatePage.getByText('Application status updated')).toBeVisible()
  await expect(candidatePage.getByText('shortlisted', { exact: false })).toBeVisible()

  await candidateCtx.close()
})
