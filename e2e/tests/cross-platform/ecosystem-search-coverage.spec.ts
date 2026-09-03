import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'

/**
 * platform_search_index (the "Ecosystem Search" nav link every app
 * shows) unioned jobs/gigs/posts only -- Salt & Pepper discussions and
 * StackWorks projects were never added, despite the feature being labeled
 * "Ecosystem" search. 037 added both. This proves a Salt & Pepper
 * discussion is now findable from a completely different app's search
 * page, with no login needed there (the view isn't RLS-gated to the
 * searcher's own session).
 */
const isLocal = process.env.E2E_TARGET === 'local'
// deepedge moved to deepedge.greyin.net -- /search lives there now,
// not on greyin.net (the ecosystem hub app has no search page of its own).
const greyinB2BBase = isLocal ? `http://localhost:${process.env.E2E_DEEPEDGE_PORT || 3100}` : 'https://deepedge.greyin.net'
const saltnpepperBase = isLocal
  ? `http://localhost:${process.env.E2E_SALTNPEPPER_PORT || 3103}`
  : 'https://saltnpepper.greyin.net'

test('a Salt & Pepper discussion shows up in deepedge\'s Ecosystem Search', async ({ page, cleanup }) => {
  // This test's project baseURL is deepedge (cross-platform project),
  // not saltnpepper -- signUpSaltNPepper/login default to relative
  // goto()s that would otherwise resolve against the wrong app.
  const author = await signUpSaltNPepper(page, cleanup, saltnpepperBase)
  await login(page, author, `${saltnpepperBase}/dashboard`, saltnpepperBase)

  const title = `E2E Search Coverage Discussion ${Date.now()}`
  await page.goto(`${saltnpepperBase}/discussions/new`)
  await page.locator('#title').fill(title)
  await page.locator('#body').fill('Exercises cross-app Ecosystem Search coverage.')
  await page.getByRole('button', { name: 'Post Discussion' }).click()
  await page.waitForURL(/\/discussions\/[^/]+$/)

  await page.goto(`${greyinB2BBase}/search?q=${encodeURIComponent(title)}`)
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByText(/Salt & Pepper/)).toBeVisible()
})
