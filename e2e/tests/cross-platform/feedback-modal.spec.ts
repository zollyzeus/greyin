import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function getFeedbackIdByMessage(message: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/platform_feedback?message=eq.${encodeURIComponent(message)}&select=id`, {
    headers: restHeaders(),
  })
  const rows = await res.json()
  expect(rows.length).toBeGreaterThan(0)
  return rows[0].id
}

// Simulates an admin's reply from Greyin Hub's /admin/feedback (which
// writes admin_reply directly on the row) -- the same UPDATE
// notify_feedback_replied() (101_wishlist_and_feedback.sql) fires on,
// producing the feedback_replied notification the badge/modal both key off.
async function seedAdminReply(feedbackId: string, reply: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/platform_feedback?id=eq.${feedbackId}`, {
    method: 'PATCH',
    headers: restHeaders(),
    body: JSON.stringify({ admin_reply: reply, status: 'replied' }),
  })
  expect(res.ok).toBeTruthy()
}

/**
 * UI/UX elevation plan, Phase 4 -- feedback/wishlist in-app modal
 * acceptance test. Reads/writes go through this app's own Supabase
 * client directly (FeedbackWishlistModal.tsx's own comment explains why:
 * real SSO + shared RLS means no Hub API/CORS round-trip is needed), so
 * this only ever needs to be exercised from one app to prove the pattern
 * -- DeepEdge, same as every other WorkspaceShell acceptance test.
 */
test('feedback modal submits, the rail badge lights up on an admin reply, and clears again on open', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, user, '/dashboard')

  const railButton = page.getByTestId('rail-feedback-button')
  const railBadge = railButton.locator('span.bg-red-600')

  await railButton.click()
  const dialog = page.getByRole('dialog', { name: 'Feedback and wishlist' })
  await expect(dialog).toBeVisible()

  const message = `E2E feedback message ${Date.now()}`
  await dialog.locator('textarea').fill(message)
  await dialog.getByRole('button', { name: 'Send feedback' }).click()

  const historyEntry = dialog.getByText(message)
  await expect(historyEntry).toBeVisible({ timeout: 10_000 })
  await expect(dialog.getByText('Awaiting reply')).toBeVisible()

  // Close the modal before the admin "replies" -- the badge should
  // reflect the new unread notification even while the modal is shut.
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).not.toBeVisible()

  const feedbackId = await getFeedbackIdByMessage(message)
  cleanup.trackEntity('platform_feedback', feedbackId)
  const replyText = 'Thanks for flagging this -- looking into it.'
  await seedAdminReply(feedbackId, replyText)

  await expect(railBadge).toHaveText('1', { timeout: 15_000 })

  // Re-opening the modal is the "read" action (FeedbackWishlistModal's own
  // useEffect marks feedback_replied read on open) -- both the reply
  // showing and the badge clearing are asserted from this one open.
  await railButton.click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Team reply')).toBeVisible()
  await expect(dialog.getByText(replyText)).toBeVisible()
  await expect(dialog.getByText('Replied')).toBeVisible()

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(railBadge).not.toBeVisible()
})

test('wishlist tab submits a feature request and upvoting toggles the count', async ({ page, cleanup }) => {
  const user = await signUpDeepEdge(page, 'candidate', cleanup)
  await login(page, user, '/dashboard')

  await page.getByTestId('rail-feedback-button').click()
  const dialog = page.getByRole('dialog', { name: 'Feedback and wishlist' })
  await dialog.getByRole('button', { name: 'Wishlist' }).click()

  const title = `E2E Wishlist Idea ${Date.now()}`
  await dialog.getByPlaceholder('What should we build?').fill(title)
  await dialog.getByRole('button', { name: 'Submit' }).click()

  const item = dialog.getByTestId('wishlist-item').filter({ hasText: title })
  await expect(item).toBeVisible({ timeout: 10_000 })

  const res = await fetch(`${SUPABASE_URL}/rest/v1/feature_requests?title=eq.${encodeURIComponent(title)}&select=id`, { headers: restHeaders() })
  const [featureRequest] = await res.json()
  cleanup.trackEntity('feature_requests', featureRequest.id)

  const upvoteButton = item.getByRole('button').first()
  await expect(upvoteButton).toContainText('0')
  await upvoteButton.click()
  await expect(upvoteButton).toContainText('1')
  await upvoteButton.click()
  await expect(upvoteButton).toContainText('0')
})
