import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { createTestDiscussionReply, getUserIdByEmail } from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

/**
 * Phase A3 of the "11 new AI enhancements" plan (2026-09-07):
 * summarizeThread() is gated internally at >=5 replies -- below that,
 * reading the thread directly is as fast as a summary. Both sides of
 * that gate are asserted: a thread with 5 real replies shows the
 * summary, a thread with fewer does not.
 */
test('a thread with 5+ replies shows an AI summary; a thread with fewer does not', async ({ page, cleanup }) => {
  test.setTimeout(90_000)
  const author = await signUpSaltNPepper(page, cleanup)
  await login(page, author, '/dashboard')
  await dismissGuidedTourIfShown(page)
  const authorId = await getUserIdByEmail(author.email)

  const longTitle = `E2E Thread Summary Long ${Date.now()}`
  await page.goto('/discussions/new')
  await page.locator('#title').fill(longTitle)
  await page.locator('#body').fill('What is the best way to structure error handling in a small Node.js API?')
  await page.getByRole('button', { name: 'Post Discussion' }).click()
  await page.waitForURL(/\/discussions\/(?!new)[^/]+$/)
  const longThreadId = page.url().split('/discussions/')[1]

  for (let i = 0; i < 5; i++) {
    await createTestDiscussionReply(longThreadId, authorId, `E2E seeded reply ${i} — use typed error classes and a generic 500 fallback.`)
  }

  const shortTitle = `E2E Thread Summary Short ${Date.now()}`
  await page.goto('/discussions/new')
  await page.locator('#title').fill(shortTitle)
  await page.locator('#body').fill('Anyone using Terraform for multi-cloud setups?')
  await page.getByRole('button', { name: 'Post Discussion' }).click()
  await page.waitForURL(/\/discussions\/(?!new)[^/]+$/)
  const shortThreadId = page.url().split('/discussions/')[1]
  await createTestDiscussionReply(shortThreadId, authorId, 'E2E seeded reply — yes, works well.')

  await page.goto(`/discussions/${longThreadId}`)
  await expect(page.getByText('AI summary of this thread')).toBeVisible({ timeout: 30_000 })

  await page.goto(`/discussions/${shortThreadId}`)
  await expect(page.getByText('AI summary of this thread')).not.toBeVisible()
})
