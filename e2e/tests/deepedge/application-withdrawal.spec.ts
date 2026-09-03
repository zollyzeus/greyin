import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle } from '../../utils/admin'

/**
 * Emergent gap audit item #2: applications.status already had a
 * 'withdrawn' value and the UI already styled it, but no route or
 * button ever set it. Covers the new RLS policy (092, scoped to
 * exactly this one transition on the candidate's own row) and the
 * withdraw button end to end -- including that the employer is
 * notified, and that withdrawing removes the button so it can't be
 * clicked twice.
 */
test('a candidate can withdraw their own application, and the employer is notified', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `E2E Withdrawal Test Role ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise application withdrawal end to end.')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')

  await candidatePage.goto(`/jobs/${jobId}/apply`)
  await candidatePage.locator('#cover_letter').fill('I am an automated test candidate.')
  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)

  const applicationRow = candidatePage.locator('div.bg-white.rounded-lg.shadow.p-6').filter({ hasText: jobTitle })
  await expect(applicationRow).toHaveCount(1)
  await expect(applicationRow.getByText('submitted')).toBeVisible()
  await applicationRow.getByRole('button', { name: 'Withdraw' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)

  const withdrawnRow = candidatePage.locator('div.bg-white.rounded-lg.shadow.p-6').filter({ hasText: jobTitle })
  await expect(withdrawnRow).toHaveCount(1)
  await expect(withdrawnRow.getByText('withdrawn')).toBeVisible()
  // The button itself is gone now -- a withdrawn application can't be
  // withdrawn again (matches the one-way-by-design scope).
  await expect(withdrawnRow.getByRole('button', { name: 'Withdraw' })).toHaveCount(0)

  await employerPage.goto('/notifications')
  await expect(employerPage.getByText('Application withdrawn')).toBeVisible()
})
