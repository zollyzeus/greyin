import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin, createTestPost } from '../../utils/admin'

/**
 * /api/admin/digest/send emails every active newsletter_subscribers row
 * about posts published in the last 7 days -- a real send through the
 * already-strained SMTP account (500/hr Hostinger cap), so this is
 * deliberately the one spec that exercises it, with exactly one
 * throwaway subscriber (confirmed empty in prod before this test) rather
 * than depending on however many real subscribers happen to exist.
 */
test('an admin can send the weekly digest and it reports the subscriber count it reached', async ({ page, cleanup }) => {
  const subscriberEmail = `test+digest-${Date.now()}@greyin.net`
  cleanup.trackByColumn('newsletter_subscribers', 'email', subscriberEmail)
  await page.goto('/')
  await page.locator('input[name="email"][placeholder="you@example.com"]').fill(subscriberEmail)
  await page.getByRole('button', { name: 'Subscribe' }).click()
  await page.waitForURL(/newsletter_success=1/)

  const post = await createTestPost({ title: `E2E Digest Post ${Date.now()}` })
  cleanup.trackEntity('posts', post.id)

  const admin = await signUpGreyMatters(page, cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(page, admin, '/dashboard')

  await page.goto('/admin')
  await page.getByRole('button', { name: 'Send weekly digest' }).click()
  await page.waitForURL(/\/admin\?success=\d+/)
  await expect(page.getByText(/Digest sent to \d+ subscriber\(s\)\./)).toBeVisible()
})
