import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'

test.describe('Reputation and anonymous posting', () => {
  test('starting a discussion earns reputation that shows up in the members directory', async ({ page, cleanup }) => {
    const author = await signUpSaltNPepper(page, cleanup)
    await login(page, author, '/dashboard')

    // award_reputation() (025_reputation.sql) grants 1 point for
    // 'discussion_created' — members/page.tsx only renders the reputation
    // badge when the score is truthy, so a fresh member with zero activity
    // must show no badge and posting once must make one appear.
    await page.goto('/members')
    const card = page.locator('div.bg-white.rounded-lg.shadow-md', { has: page.getByRole('heading', { name: author.lastName }) })
    await expect(card.getByText(/reputation/)).toHaveCount(0)

    const title = `E2E Karma Discussion ${Date.now()}`
    await page.goto('/discussions/new')
    await page.locator('#title').fill(title)
    await page.locator('#body').fill('Posted to exercise the reputation system.')
    await page.getByRole('button', { name: 'Post Discussion' }).click()
    await page.waitForURL(/\/discussions\/(?!new)[^/]+$/)

    await page.goto('/members')
    const cardAfter = page.locator('div.bg-white.rounded-lg.shadow-md', { has: page.getByRole('heading', { name: author.lastName }) })
    await expect(cardAfter.getByText('1 reputation')).toBeVisible()
  })

  test('an anonymous discussion hides the author\'s name from other members', async ({ browser, cleanup }) => {
    const authorCtx = await browser.newContext()
    const authorPage = await authorCtx.newPage()
    const author = await signUpSaltNPepper(authorPage, cleanup)
    await login(authorPage, author, '/dashboard')

    const title = `E2E Anonymous Discussion ${Date.now()}`
    await authorPage.goto('/discussions/new')
    await authorPage.locator('#title').fill(title)
    await authorPage.locator('#body').fill('This should show as posted by Anonymous Member.')
    await authorPage.locator('input[name="is_anonymous"]').check()
    await authorPage.getByRole('button', { name: 'Post Discussion' }).click()
    await authorPage.waitForURL(/\/discussions\/(?!new)[^/]+$/)
    const discussionUrl = authorPage.url()
    await authorCtx.close()

    // A different member viewing the same discussion must see "Anonymous
    // Member" — never the real author name — while the real author_id is
    // still stored server-side for moderation (not something e2e can check
    // through the UI, already covered by the RLS/schema design itself).
    const viewerCtx = await browser.newContext()
    const viewerPage = await viewerCtx.newPage()
    const viewer = await signUpSaltNPepper(viewerPage, cleanup)
    await login(viewerPage, viewer, '/dashboard')

    await viewerPage.goto(discussionUrl)
    // exact: true so this matches only the author byline span, not the
    // discussion body text above, which also happens to contain the
    // literal phrase "Anonymous Member".
    await expect(viewerPage.getByText('Anonymous Member', { exact: true })).toBeVisible()
    await expect(viewerPage.getByText(author.lastName)).toHaveCount(0)

    await viewerCtx.close()
  })
})
