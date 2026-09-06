import { test, expect } from '../../utils/fixtures'
import { signUpLongList, login } from '../../utils/auth'

test.describe('Longlist auth', () => {
  test('a member can sign up and log in', async ({ page, cleanup }) => {
    const user = await signUpLongList(page, cleanup)
    await login(page, user, '/dashboard')
    await expect(page.getByText('Your Longlist')).toBeVisible()
    // Scoped to <main> -- the persistent rail (UI/UX elevation rollout,
    // 2026-09-05) added its own "Browse Future Roles" nav link outside
    // <main>, with the same accessible name as this dashboard card, so an
    // unscoped locator is a strict-mode violation. Same fix pattern
    // already used for StackWorks's "Post a Project" and Salt & Pepper's
    // messaging-name collisions.
    await expect(page.locator('main').getByRole('link', { name: 'Browse Future Roles' })).toBeVisible()
  })

  test('a signed-out visitor browsing /roles is sent to login and back', async ({ page }) => {
    await page.goto('/roles')
    await expect(page).toHaveURL(/\/login\?next=\/roles/)
  })
})
