import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { getUserIdByEmail, getReputationEvents } from '../../utils/admin'

// Real up/down voting (146_discussion_voting.sql) -- discussions.upvote_count
// had no write path at all before this (flagged in 025's own comment, never
// fixed), silently degrading the "hot"/"top" sorts to reply-count-only /
// arbitrary order. This proves the actual vote mechanism, not just the UI.
test.describe('Discussion voting', () => {
  test('a member can upvote, switch to downvote, and toggle off a discussion vote', async ({ browser, cleanup }) => {
    const authorCtx = await browser.newContext()
    const authorPage = await authorCtx.newPage()
    const author = await signUpSaltNPepper(authorPage, cleanup)
    await login(authorPage, author, '/dashboard')
    const authorId = await getUserIdByEmail(author.email)

    const title = `E2E Vote Discussion ${Date.now()}`
    await authorPage.goto('/discussions/new')
    await authorPage.locator('#title').fill(title)
    // Content reads as a genuine discussion post -- neither "Vote on me,
    // Playwright" (read literally as soliciting votes/attention on an
    // individual) nor meta "test post to exercise X" phrasing (observed
    // separately being blocked as low-effort/off-topic) survive the
    // pre-publish moderation LLM (098) reliably; both false-positive
    // classes were silently masked before 2026-09-12's waitForURL race
    // fix, which had let this test "pass" without ever actually
    // creating the discussion.
    await authorPage.locator('#body').fill('Sharing a checklist we use before rolling out a schema migration to production, happy to hear what others would add.')
    await authorPage.getByRole('button', { name: 'Post Discussion' }).click()
    await authorPage.waitForURL(/\/discussions\/(?!new)[^/]+$/)
    const discussionUrl = authorPage.url()

    const voterCtx = await browser.newContext()
    const voterPage = await voterCtx.newPage()
    const voter = await signUpSaltNPepper(voterPage, cleanup)
    await login(voterPage, voter, '/dashboard')

    await voterPage.goto(discussionUrl)

    // Upvote: score 0 -> 1
    await voterPage.getByRole('button', { name: 'Upvote' }).click()
    await expect(voterPage.getByText('1', { exact: true })).toBeVisible()

    // Switch to downvote: score 1 -> -1
    await voterPage.getByRole('button', { name: 'Downvote' }).click()
    await expect(voterPage.getByText('-1', { exact: true })).toBeVisible()

    // Toggle off: score -1 -> 0
    await voterPage.getByRole('button', { name: 'Downvote' }).click()
    await expect(voterPage.getByText('0', { exact: true })).toBeVisible()

    // Re-upvote and leave it, then verify server-side state directly.
    await voterPage.getByRole('button', { name: 'Upvote' }).click()
    await expect(voterPage.getByText('1', { exact: true })).toBeVisible()
    await voterPage.waitForTimeout(500)

    const events = await getReputationEvents(authorId, 'discussion_upvoted')
    expect(events.length).toBeGreaterThan(0)
    expect(events[events.length - 1].points).toBe(1)

    // 'top' sort should now reflect the real, non-zero score.
    await authorPage.goto('/discussions?sort=top')
    await expect(authorPage.getByText(title)).toBeVisible()

    await authorCtx.close()
    await voterCtx.close()
  })
})
