import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, login } from '../../utils/auth'
import { getUserIdByEmail } from '../../utils/admin'

/**
 * Public track-record badge (competitive audit, Aug 2026): the whole
 * point is that it's embeddable outside the app -- resumes, LinkedIn --
 * so it must render with zero session/cookies, unlike every other
 * StackWorks route. Verified via a completely fresh, never-logged-in
 * request context, not just an authenticated one.
 */
test('the track-record badge renders as public SVG with no login, and the dashboard shows its embed snippet', async ({ browser, cleanup }) => {
  const userCtx = await browser.newContext()
  const userPage = await userCtx.newPage()
  const user = await signUpStackWorksBuilder(userPage, cleanup)
  await login(userPage, user, '/dashboard')
  const userId = await getUserIdByEmail(user.email)

  await expect(userPage.getByText('Your track record badge')).toBeVisible()
  await expect(userPage.locator(`img[src="/api/badge/${userId}"]`)).toBeVisible()
  await expect(userPage.locator('textarea')).toHaveValue(new RegExp(`/api/badge/${userId}`))
  await userCtx.close()

  const anonCtx = await browser.newContext()
  const anonPage = await anonCtx.newPage()
  const response = await anonPage.request.get(`/api/badge/${userId}`)
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('image/svg+xml')
  const svg = await response.text()
  expect(svg).toContain(user.lastName)
  expect(svg).toContain('STACKWORKS VERIFIED')
  expect(svg).toContain('0 verified outcomes')
  await anonCtx.close()
})
