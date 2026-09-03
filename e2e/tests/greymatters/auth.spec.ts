import { test, expect } from '../../utils/fixtures'
import { signUpGreyMatters, login } from '../../utils/auth'

test.describe('GreyMatters auth', () => {
  test('a reader can sign up and log in', async ({ page, cleanup }) => {
    const user = await signUpGreyMatters(page, cleanup)
    await login(page, user, '/dashboard')
  })

  test('wrong password shows an error', async ({ page, cleanup }) => {
    const user = await signUpGreyMatters(page, cleanup)
    await page.goto('/login')
    await page.locator('#email').fill(user.email)
    await page.locator('#password').fill('WrongPassword123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/error=/)
  })
})
