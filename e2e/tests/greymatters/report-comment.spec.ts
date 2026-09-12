import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { createTestPost } from '../../utils/admin'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
}

/**
 * Platform-wide abuse-vector audit (2026-09-13): comments.status
 * (approved|pending|spam) has existed since 001_initial_schema.sql but
 * nothing ever set it to anything but 'approved' at insert -- readers
 * were fully exposed to other readers' comments with zero recourse.
 * Reporting (152) now soft-hides the comment immediately by flipping
 * that same status to 'pending', which the table's own pre-existing
 * RLS policy ("status = 'approved'" to be publicly visible) then
 * naturally excludes -- no new hide mechanism needed.
 */
test('reporting a comment hides it immediately, and it lands in content_reports', async ({ browser, cleanup }) => {
  const post = await createTestPost()
  cleanup.trackEntity('posts', post.id)

  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpGreyMatters(authorPage, cleanup)
  await login(authorPage, author, '/dashboard')
  await authorPage.goto(`/posts/${post.slug}`)
  const commentText = `E2E reportable comment ${Date.now()}`
  await authorPage.locator('textarea[name="content"]').fill(commentText)
  await authorPage.getByRole('button', { name: 'Post Comment' }).click()
  await authorPage.waitForURL(new RegExp(`/posts/${post.slug}`))
  await expect(authorPage.getByText(commentText)).toBeVisible()
  await authorCtx.close()

  const reporterCtx = await browser.newContext()
  const reporterPage = await reporterCtx.newPage()
  const reporter = await signUpGreyMatters(reporterPage, cleanup)
  await login(reporterPage, reporter, '/dashboard')
  await reporterPage.goto(`/posts/${post.slug}`)

  await reporterPage.getByText(commentText).locator('xpath=following-sibling::details[1]').getByText('Report', { exact: true }).click()
  const reason = `E2E comment report reason ${Date.now()}`
  await reporterPage.locator('textarea[name="reason"]').fill(reason)
  await reporterPage.getByRole('button', { name: 'Submit report' }).click()
  await reporterPage.waitForURL(/\?reported=1/)
  await expect(reporterPage.getByText('Report submitted')).toBeVisible()

  // Soft-hidden immediately for EVERY reader, not just the reporter.
  await expect(reporterPage.getByText(commentText)).not.toBeVisible()
  await reporterPage.reload()
  await expect(reporterPage.getByText(commentText)).not.toBeVisible()

  const reportsRes = await fetch(`${SUPABASE_URL}/rest/v1/content_reports?content_type=eq.greymatters_comment&reason=eq.${encodeURIComponent(reason)}&select=status`, {
    headers: restHeaders(),
  })
  const rows = await reportsRes.json()
  expect(rows.length).toBe(1)
  expect(rows[0].status).toBe('open')

  const commentRes = await fetch(`${SUPABASE_URL}/rest/v1/comments?content=eq.${encodeURIComponent(commentText)}&select=status`, {
    headers: restHeaders(),
  })
  const [comment] = await commentRes.json()
  expect(comment.status).toBe('pending')

  await reporterCtx.close()
})
