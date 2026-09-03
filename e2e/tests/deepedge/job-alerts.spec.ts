import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

test('a candidate is notified when a job matching their saved alert is posted', async ({ browser, cleanup }) => {
  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')

  const keyword = `E2EAlertKeyword${Date.now()}`
  await candidatePage.goto(`/jobs?q=${keyword}`)
  await candidatePage.getByRole('button', { name: 'Get notified about new jobs matching this search' }).click()
  await candidatePage.waitForURL(/\/dashboard\/alerts/)
  await expect(candidatePage.getByText(keyword)).toBeVisible()

  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `${keyword} Staff Engineer`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise job alert notifications.')
  await employerPage.locator('#location').fill('Remote')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  await employerCtx.close()

  await candidatePage.goto('/dashboard')
  await expect(candidatePage.getByTitle('Notifications')).toContainText('1')
  await candidatePage.goto('/notifications')
  await expect(candidatePage.getByText('New job matching your alert')).toBeVisible()
  await expect(candidatePage.getByText(jobTitle, { exact: false })).toBeVisible()

  // Candidate deletes the saved alert -- it should disappear from their
  // list, and a subsequently-matching job should no longer notify them.
  await candidatePage.goto('/dashboard/alerts')
  await expect(candidatePage.getByText(keyword)).toBeVisible()
  await candidatePage.getByRole('button', { name: 'Delete' }).click()
  await candidatePage.waitForURL('/dashboard/alerts')
  await expect(candidatePage.getByText(keyword)).not.toBeVisible()
  await expect(candidatePage.getByText('No alerts yet', { exact: false })).toBeVisible()

  const employerCtx2 = await browser.newContext()
  const employerPage2 = await employerCtx2.newPage()
  const employer2 = await signUpDeepEdge(employerPage2, 'employer', cleanup)
  await login(employerPage2, employer2, '/employer/dashboard')

  const secondJobTitle = `${keyword} Second Role`
  await employerPage2.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage2.waitForURL('/employer/post-job')
  await employerPage2.locator('#title').fill(secondJobTitle)
  await employerPage2.locator('#description').fill('Posted after the alert was deleted -- should not notify.')
  await employerPage2.locator('#location').fill('Remote')
  await employerPage2.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage2.waitForURL('/employer/dashboard')
  await employerCtx2.close()

  // No new notification -- the earlier /notifications visit already
  // marked the first one read, and the deleted alert shouldn't have
  // produced a second (the unread badge only renders at all once
  // unreadCount > 0, so its absence here is itself the "zero" signal).
  await candidatePage.goto('/dashboard')
  await expect(candidatePage.getByTitle('Notifications')).not.toContainText(/\d/)
  await candidatePage.goto('/notifications')
  await expect(candidatePage.getByText(secondJobTitle, { exact: false })).not.toBeVisible()

  await candidateCtx.close()
})
