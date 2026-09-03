import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'
import { createTestPost, getUserIdByEmail } from '../../utils/admin'
import { mockRazorpayCheckout } from '../../utils/razorpay'

/**
 * Mocks Razorpay's checkout.js (see utils/razorpay.ts) rather than driving
 * the real hosted widget — this exercises the app's own checkout wiring and
 * its /api/tips/verify signature-verification logic for real, without
 * depending on a third-party iframe's DOM/UI stability.
 */
test('a reader can tip a post author, who then sees it on their dashboard', async ({ browser, cleanup }) => {
  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpGreyMatters(authorPage, cleanup)
  const authorId = await getUserIdByEmail(author.email)

  const { id: postId, slug } = await createTestPost({
    title: `E2E Tip Post ${Date.now()}`,
    author_id: authorId,
  })
  // author_tips cascades from either posts.id or profiles.id, both already
  // tracked, so the tip row itself needs no separate tracking.
  cleanup.trackEntity('posts', postId)

  const readerCtx = await browser.newContext()
  const readerPage = await readerCtx.newPage()
  const reader = await signUpGreyMatters(readerPage, cleanup)
  await login(readerPage, reader, '/dashboard')

  await mockRazorpayCheckout(readerPage)

  await readerPage.goto(`/posts/${slug}`)
  await readerPage.getByRole('button', { name: /Tip/ }).click()

  await expect(readerPage.getByText(/Thank you for supporting/i)).toBeVisible({ timeout: 30_000 })
  await readerCtx.close()

  await login(authorPage, author, '/dashboard')
  await authorPage.goto('/dashboard')
  await expect(authorPage.getByText(/received.*in reader tips/i)).toBeVisible()

  await authorCtx.close()
})
