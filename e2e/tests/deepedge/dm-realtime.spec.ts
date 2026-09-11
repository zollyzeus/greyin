import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, grantActiveSubscriptionTier, getUserIdByEmail } from '../../utils/admin'

// Real-time DM threads (147_direct_messages_realtime.sql, Emergent-parity
// gap #2 part 2) -- messages/[id]/page.tsx was a plain server component, so
// a message from the other participant never appeared without a manual
// reload. This proves the actual regression fixed: the RECEIVING side's
// already-open thread page updates with no reload/navigation at all.
test('a new message appears on the other participant\'s already-open thread with no reload', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `E2E Realtime DM Role ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise realtime DM delivery.')
  await employerPage.locator('#location').fill('Remote')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')

  const jobId = await getJobIdByTitle(jobTitle)

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')
  await candidatePage.goto(`/jobs/${jobId}/apply`)
  await candidatePage.locator('#cover_letter').fill('E2E realtime DM test candidate.')
  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)

  await employerPage.goto(`/employer/jobs/${jobId}/applications`)
  await employerPage.getByRole('button', { name: 'Message candidate' }).click()
  await employerPage.waitForURL(/\/messages\/[^/]+$/)
  const conversationId = employerPage.url().split('/messages/')[1]
  cleanup.trackEntity('conversations', conversationId)

  const firstMessage = `E2E realtime first message ${Date.now()}`
  await employerPage.getByPlaceholder('Type a message...').fill(firstMessage)
  await employerPage.getByRole('button', { name: 'Send' }).click()
  await expect(employerPage.getByText(firstMessage)).toBeVisible()

  // Candidate opens the thread once (picks up the first message via the
  // normal server-rendered load), then we never reload/navigate this page
  // again -- everything after this point must arrive live.
  await candidatePage.goto(`/messages/${conversationId}`)
  await expect(candidatePage.getByText(firstMessage)).toBeVisible()

  const liveMessage = `E2E realtime LIVE message ${Date.now()}`
  await employerPage.getByPlaceholder('Type a message...').fill(liveMessage)
  await employerPage.getByRole('button', { name: 'Send' }).click()
  await expect(employerPage.getByText(liveMessage)).toBeVisible()

  // No reload/goto on candidatePage between opening the thread and this
  // assertion -- if this fails, the page is not actually receiving live
  // updates. Scoped to <main> since NotificationBell's own arrival toast
  // (also real-time, unrelated to this feature) repeats the same text.
  await expect(candidatePage.locator('main').getByText(liveMessage)).toBeVisible({ timeout: 10000 })

  await employerCtx.close()
  await candidateCtx.close()
})
