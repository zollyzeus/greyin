import { test, expect } from '../../utils/fixtures'
import { signUpLongList, login } from '../../utils/auth'

test.describe('Longlist auth', () => {
  test('a member can sign up and log in', async ({ page, cleanup }) => {
    const user = await signUpLongList(page, cleanup)
    await login(page, user, '/dashboard')
    await expect(page.getByText('Your Longlist')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Browse Future Roles' })).toBeVisible()
  })

  test('a signed-out visitor browsing /roles is sent to login and back', async ({ page }) => {
    await page.goto('/roles')
    await expect(page).toHaveURL(/\/login\?next=\/roles/)
  })
})
