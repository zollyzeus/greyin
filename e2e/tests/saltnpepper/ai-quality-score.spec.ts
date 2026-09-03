import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'

/**
 * Salt & Pepper has no per-reply reaction mechanism and replying is a
 * high-frequency, casual action, so this doesn't hook the reply POST
 * itself -- instead, loading the thread lazily scores up to 3 unscored
 * replies (048_ai_quality_scores.sql), matching the same "no pg_cron,
 * do it opportunistically" pattern finalize_expired_verified_outcomes()
 * already uses. The reply form's own redirect back to the thread page
 * IS that lazy-scoring trigger, so no extra reload is needed here.
 * Additive/informational only (doesn't feed greyin_score), and shown on
 * the replier's profile only (user-confirmed), never inline in the
 * thread. Score is non-deterministic (a real local model), so only the
 * pattern is asserted.
 */
test('posting a reply triggers a lazy AI mentoring-quality score visible on the replier\'s profile', async ({ browser, cleanup }) => {
  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpSaltNPepper(authorPage, cleanup)
  await login(authorPage, author, '/dashboard')

  const title = `E2E AI Quality Discussion ${Date.now()}`
  await authorPage.goto('/discussions/new')
  await authorPage.locator('#title').fill(title)
  await authorPage.locator('#body').fill('How should I structure error handling in a small Node.js API?')
  await authorPage.getByRole('button', { name: 'Post Discussion' }).click()
  await authorPage.waitForURL(/\/discussions\/[^/]+$/)

  const replierCtx = await browser.newContext()
  const replierPage = await replierCtx.newPage()
  const replier = await signUpSaltNPepper(replierPage, cleanup)
  await login(replierPage, replier, '/dashboard')

  await replierPage.goto(authorPage.url())
  const replyText = `Centralize it in one error-handling middleware, use typed error classes for expected cases like validation failures, and let anything unexpected fall through to a generic 500 handler that logs with a request id — ${Date.now()}`
  await replierPage.locator('textarea[name="body"]').fill(replyText)
  await replierPage.getByRole('button', { name: 'Post Reply' }).click()
  await expect(replierPage.getByText(replyText)).toBeVisible()

  await replierPage.goto('/profile')
  await expect(replierPage.getByText(/\d+ scored repl(y|ies) · avg \d+\/100/)).toBeVisible({ timeout: 30_000 })

  await authorCtx.close()
  await replierCtx.close()
})
