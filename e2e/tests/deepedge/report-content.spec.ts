import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, grantActiveSubscriptionTier, getUserIdByEmail } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
}

/**
 * Platform-wide abuse-vector audit (2026-09-13) found company_reviews to
 * be the highest-priority gap: an anonymous poster, real company
 * reputation at stake, and zero admin discoverability (no admin UI ever
 * listed them). This is the receiver-side "Report" fix (152) -- a
 * candidate reading a review about a company they're evaluating can now
 * flag it, landing in the shared content_reports queue.
 */
test('a candidate can report a company review, and it lands in content_reports', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `E2E Report Review Role ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise reporting a company review.')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)
  await employerCtx.close()

  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpDeepEdge(authorPage, 'candidate', cleanup)
  await login(authorPage, author, '/dashboard')
  await authorPage.goto(`/jobs/${jobId}/apply`)
  await authorPage.locator('#cover_letter').fill('Applying so I can leave a review afterward.')
  await authorPage.getByRole('button', { name: 'Submit Application' }).click()
  await authorPage.waitForURL(/\/dashboard\/applications/)
  await authorPage.goto(`/jobs/${jobId}`)
  await authorPage.locator('a[href^="/companies/"]').first().click()
  await authorPage.waitForURL(/\/companies\//)
  const reviewText = `E2E reportable review ${Date.now()}`
  await authorPage.getByLabel('Your rating').selectOption('1')
  await authorPage.locator('textarea[name="review_text"]').fill(reviewText)
  await authorPage.getByRole('button', { name: 'Submit review' }).click()
  await authorPage.waitForURL(/\/companies\//)
  const companyUrl = authorPage.url()
  await authorCtx.close()

  const reporterCtx = await browser.newContext()
  const reporterPage = await reporterCtx.newPage()
  const reporter = await signUpDeepEdge(reporterPage, 'candidate', cleanup)
  const reporterId = await getUserIdByEmail(reporter.email)
  await login(reporterPage, reporter, '/dashboard')
  await reporterPage.goto(companyUrl)

  await reporterPage.getByText(reviewText).locator('xpath=following-sibling::details[1]').getByText('Report', { exact: true }).click()
  const reportReason = `E2E report reason ${Date.now()}`
  await reporterPage.locator('textarea[name="reason"]').fill(reportReason)
  await reporterPage.getByRole('button', { name: 'Submit report' }).click()
  await reporterPage.waitForURL(/\?reported=1/)
  await expect(reporterPage.getByText('Report submitted')).toBeVisible()

  const res = await fetch(`${SUPABASE_URL}/rest/v1/content_reports?reporter_id=eq.${reporterId}&content_type=eq.company_review&select=reason,status`, {
    headers: restHeaders(),
  })
  const rows = await res.json()
  expect(rows.length).toBe(1)
  expect(rows[0].reason).toBe(reportReason)
  expect(rows[0].status).toBe('open')

  await reporterCtx.close()
})

/**
 * Direct-message harassment (152): the platform's clearest 1:1 vector
 * with no recourse before this -- a receiver can now report AND block,
 * and blocking actually stops future messages (not just a cosmetic
 * label), enforced at the RLS/RPC layer, not just hidden in the UI.
 */
test('a message recipient can report and block the sender, and the sender can no longer message them', async ({ browser, cleanup }) => {
  const senderCtx = await browser.newContext()
  const senderPage = await senderCtx.newPage()
  const sender = await signUpDeepEdge(senderPage, 'candidate', cleanup)
  const senderId = await getUserIdByEmail(sender.email)
  await login(senderPage, sender, '/dashboard')

  const recipientCtx = await browser.newContext()
  const recipientPage = await recipientCtx.newPage()
  const recipient = await signUpDeepEdge(recipientPage, 'candidate', cleanup)
  const recipientId = await getUserIdByEmail(recipient.email)
  await login(recipientPage, recipient, '/dashboard')

  // No UI entry point exists between two arbitrary candidates on
  // DeepEdge -- seed the conversation directly via the service role
  // (get_or_create_conversation itself requires a real auth.uid(), which
  // a service-role call has none of).
  const convRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
    method: 'POST',
    headers: { ...restHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({}),
  })
  const [conversation] = await convRes.json()
  await fetch(`${SUPABASE_URL}/rest/v1/conversation_participants`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify([
      { conversation_id: conversation.id, user_id: senderId },
      { conversation_id: conversation.id, user_id: recipientId },
    ]),
  })
  await fetch(`${SUPABASE_URL}/rest/v1/direct_messages`, {
    method: 'POST',
    headers: restHeaders(),
    body: JSON.stringify({ conversation_id: conversation.id, sender_id: senderId, body: 'Unwanted message.' }),
  })

  await recipientPage.goto(`/messages/${conversation.id}`)
  await expect(recipientPage.getByText('Unwanted message.')).toBeVisible()

  await recipientPage.getByText('Report', { exact: true }).click()
  await recipientPage.locator('textarea[name="reason"]').fill('Harassment.')
  await recipientPage.getByRole('button', { name: 'Submit report' }).click()
  await recipientPage.waitForURL(/\?reported=1/)

  await recipientPage.goto(`/messages/${conversation.id}`)
  recipientPage.once('dialog', (d) => d.accept())
  await recipientPage.getByRole('button', { name: 'Block' }).click()
  await recipientPage.waitForURL(/\/messages\?blocked=1/)

  const blockRes = await fetch(`${SUPABASE_URL}/rest/v1/blocked_users?blocker_id=eq.${recipientId}&blocked_id=eq.${senderId}`, {
    headers: restHeaders(),
  })
  expect((await blockRes.json()).length).toBe(1)

  // Sender can no longer send into the existing conversation -- the
  // direct_messages INSERT policy itself blocks it (RLS, not app code).
  await senderPage.goto(`/messages/${conversation.id}`)
  await senderPage.locator('input[placeholder="Type a message..."]').fill('Trying again after being blocked.')
  await senderPage.getByRole('button', { name: 'Send' }).click()
  await senderPage.waitForTimeout(1000)
  await expect(senderPage.getByText('Trying again after being blocked.')).not.toBeVisible()

  await senderCtx.close()
  await recipientCtx.close()
})
