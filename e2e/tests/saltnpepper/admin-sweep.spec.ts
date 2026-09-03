import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin, createTestDiscussionReply } from '../../utils/admin'

/**
 * The admin's own manual "Sweep now" action (sweepUnscoredReplies via
 * /api/admin/sweep-replies, 048_ai_quality_scores.sql). Posting a reply
 * through the real UI redirects back to the thread page, which itself
 * runs a lazy per-thread sweep (reply-quality.ts) -- that would score a
 * reply posted through /discussions/[id]/reply before this test ever
 * got to exercise the admin panel. createTestDiscussionReply() seeds the
 * reply directly via the service role instead, so it stays genuinely
 * unscored until this test's own explicit sweep.
 *
 * The admin (who also authors the discussion/reply here, to avoid a
 * second throwaway account) logs in *before* the reply is created --
 * that login's own /dashboard landing is itself an opportunistic sweep,
 * consumed before this test's reply exists -- and never revisits
 * /dashboard or the thread page again before clicking "Sweep now", so
 * nothing else can race this reply out of the backlog first.
 */
test('an admin can sweep the AI quality backlog and it scores a real unscored reply', async ({ page, cleanup }) => {
  const admin = await signUpSaltNPepper(page, cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(page, admin, '/dashboard')

  const title = `E2E Sweep Backlog Discussion ${Date.now()}`
  await page.goto('/discussions/new')
  await page.locator('#title').fill(title)
  await page.locator('#body').fill('Seeded so a reply can be added directly, bypassing the lazy per-thread sweep.')
  await page.getByRole('button', { name: 'Post Discussion' }).click()
  await page.waitForURL(/\/discussions\/[^/]+$/)
  const discussionId = page.url().split('/discussions/')[1]

  const replyBody = `E2E sweep backlog reply ${Date.now()} -- structure error handling behind one typed middleware.`
  await createTestDiscussionReply(discussionId, adminId, replyBody)

  await page.goto('/admin')
  await expect(page.getByText(title)).toBeVisible()

  await page.getByRole('button', { name: 'Sweep now' }).click()
  await page.waitForURL(/\/admin\?swept=\d+&remaining=\d+/)
  await expect(page.getByText(/Swept \d+ repl(y|ies) — \d+ still unscored/)).toBeVisible()

  await page.goto('/profile')
  await expect(page.getByText(/\d+ scored repl(y|ies) · avg \d+\/100/)).toBeVisible({ timeout: 30_000 })
})
