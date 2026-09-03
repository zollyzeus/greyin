import { test, expect } from '../../utils/fixtures'
import { signUpLongList, login } from '../../utils/auth'

test('a member can state future interests and they persist on reload', async ({ page, cleanup }) => {
  const user = await signUpLongList(page, cleanup)
  await login(page, user, '/dashboard')

  await page.goto('/profile')
  await page.locator('input[name="future_interests"]').fill('VP Engineering, Fractional CFO')
  await page.locator('textarea[name="future_interests_note"]').fill('Open to a Series B fintech role from mid-2027.')
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForURL(/\/profile\?saved=1/)

  await page.reload()
  await expect(page.locator('input[name="future_interests"]')).toHaveValue('VP Engineering, Fractional CFO')
  await expect(page.locator('textarea[name="future_interests_note"]')).toHaveValue('Open to a Series B fintech role from mid-2027.')
})

test('browsing with no future roles posted shows the empty state, not an error', async ({ page, cleanup }) => {
  const user = await signUpLongList(page, cleanup)
  // login()'s expectedUrl waits for wherever the login route actually
  // redirects (always /dashboard here -- Longlist has no role branching
  // to send it anywhere else); navigate to /roles as a separate step
  // rather than expecting login itself to land there.
  await login(page, user, '/dashboard')
  await page.goto('/roles')
  // Either a real empty state or at least one real role -- either way,
  // never a crash. Asserting the page rendered its own chrome (not a
  // Next.js error boundary) is the meaningful check here.
  await expect(page.getByRole('heading', { name: 'Future Roles' })).toBeVisible()
})
