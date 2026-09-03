import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin, createTestPost } from '../../utils/admin'

/**
 * The admin's own manual "Sweep now" action (sweepUnscoredPosts via
 * /api/admin/sweep-posts, 048_ai_quality_scores.sql) as opposed to the
 * automatic catch-up ai-quality-score.spec.ts already exercises through
 * a real /posts/new publish. createTestPost() seeds a post directly via
 * the service role, bypassing the create/update routes that normally
 * score synchronously on publish -- that's the only way to produce a
 * genuinely *unscored* post for this backlog-draining action to act on.
 *
 * The admin logs in (and lands on /dashboard, itself an opportunistic
 * sweep of up to 3 posts) *before* the test post is created, and never
 * revisits /dashboard afterward -- so nothing else can race this test's
 * own post out of the backlog ahead of the explicit "Sweep now" click.
 */
test('an admin can sweep the AI quality backlog and it scores a real unscored post', async ({ page, cleanup }) => {
  const admin = await signUpGreyMatters(page, cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(page, admin, '/dashboard')

  const title = `E2E Sweep Backlog Post ${Date.now()}`
  const post = await createTestPost({ title, author_id: adminId })
  // posts.author_id is ON DELETE SET NULL, not CASCADE -- track explicitly.
  cleanup.trackEntity('posts', post.id)

  await page.goto('/admin')
  await expect(page.getByText(title)).toBeVisible()

  await page.getByRole('button', { name: 'Sweep now' }).click()
  await page.waitForURL(/\/admin\?swept=\d+&remaining=\d+/)
  await expect(page.getByText(/Swept \d+ posts? — \d+ still unscored/)).toBeVisible()

  await page.goto(`/posts/${post.slug}`)
  await expect(page.getByText(/AI quality: \d+\/100/)).toBeVisible({ timeout: 30_000 })
})
