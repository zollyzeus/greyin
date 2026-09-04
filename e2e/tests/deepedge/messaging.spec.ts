import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, grantActiveSubscriptionTier, getUserIdByEmail } from '../../utils/admin'

test('an employer can message a candidate from the applications review page', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `E2E Messaging Role ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise employer-candidate messaging.')
  await employerPage.locator('#location').fill('Remote')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')

  const jobId = await getJobIdByTitle(jobTitle)

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')
  await candidatePage.goto(`/jobs/${jobId}/apply`)
  await candidatePage.locator('#cover_letter').fill('E2E messaging test candidate.')
  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)

  await employerPage.goto(`/employer/jobs/${jobId}/applications`)
  await employerPage.getByRole('button', { name: 'Message candidate' }).click()
  await employerPage.waitForURL(/\/messages\/[^/]+$/)
  // conversations has no FK back to profiles (only conversation_participants
  // and direct_messages do), so deleting both participants cascades away
  // the participant/message rows but leaves an empty, orphaned conversation
  // behind unless it's tracked explicitly.
  cleanup.trackEntity('conversations', employerPage.url().split('/messages/')[1])

  const messageText = `E2E employer message ${Date.now()}`
  await employerPage.getByPlaceholder('Type a message...').fill(messageText)
  await employerPage.getByRole('button', { name: 'Send' }).click()
  await expect(employerPage.getByText(messageText)).toBeVisible()
  await employerCtx.close()

  await candidatePage.goto('/dashboard')
  await expect(candidatePage.getByLabel('Notifications')).toContainText('1')
  await candidatePage.goto('/messages')
  await expect(candidatePage.getByText(employer.firstName, { exact: false })).toBeVisible()

  await candidateCtx.close()
})
