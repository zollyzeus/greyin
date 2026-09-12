import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'

/**
 * Smoke test for the new platform-wide follow graph + per-post
 * feed_visibility (053_activity_feed.sql), exercised end to end through
 * Salt & Pepper -- the reference implementation this pattern is
 * replicated from into the other 4 apps. Covers: follow via /members,
 * a public post showing in the follower's /feed, and a private post
 * from the same author not showing.
 */
test('a follower sees a followed member\'s public discussion in /feed but not their private one', async ({ browser, cleanup }) => {
  const authorCtx = await browser.newContext()
  const authorPage = await authorCtx.newPage()
  const author = await signUpSaltNPepper(authorPage, cleanup)
  await login(authorPage, author, '/dashboard')

  const publicTitle = `E2E Feed Public Discussion ${Date.now()}`
  await authorPage.goto('/discussions/new')
  await authorPage.locator('#title').fill(publicTitle)
  await authorPage.locator('#body').fill('Visible to followers.')
  await authorPage.locator('select[name="feed_visibility"]').selectOption('public')
  await authorPage.getByRole('button', { name: 'Post Discussion' }).click()
  await authorPage.waitForURL(/\/discussions\/(?!new)[^/]+$/)

  const privateTitle = `E2E Feed Private Discussion ${Date.now()}`
  await authorPage.goto('/discussions/new')
  await authorPage.locator('#title').fill(privateTitle)
  await authorPage.locator('#body').fill('Not distributed to followers.')
  await authorPage.locator('select[name="feed_visibility"]').selectOption('private')
  await authorPage.getByRole('button', { name: 'Post Discussion' }).click()
  await authorPage.waitForURL(/\/discussions\/(?!new)[^/]+$/)

  const followerCtx = await browser.newContext()
  const followerPage = await followerCtx.newPage()
  const follower = await signUpSaltNPepper(followerPage, cleanup)
  await login(followerPage, follower, '/dashboard')

  // full_name ("E2E {lastName}") is unique per test run (testUser.ts),
  // so this reliably targets the author's own card even with other real
  // members present on /members.
  await followerPage.goto('/members')
  const authorCard = followerPage.locator('div.bg-white', { hasText: author.lastName })
  await authorCard.getByRole('button', { name: 'Follow' }).click()
  await followerPage.waitForURL('/members')
  await expect(authorCard.getByRole('button', { name: 'Unfollow' })).toBeVisible()

  await followerPage.goto('/feed')
  await expect(followerPage.getByText(publicTitle)).toBeVisible()
  await expect(followerPage.getByText(privateTitle)).not.toBeVisible()

  await authorCtx.close()
  await followerCtx.close()
})
