import { test, expect } from '../../utils/fixtures'
import { signUpSaltNPepper, login } from '../../utils/auth'
import { makeTestUser } from '../../utils/testUser'
import { waitForURLResilient } from '../../utils/nav'

test.describe('Salt & Pepper auth and experience gate', () => {
  test('a member with 12+ years of experience can sign up and log in', async ({ page, cleanup }) => {
    const user = await signUpSaltNPepper(page, cleanup)
    await login(page, user, '/dashboard')
    await expect(page.getByText(`Welcome, ${user.firstName} ${user.lastName}`)).toBeVisible()
  })

  test('signup is rejected for under 12 years of experience', async ({ page, cleanup }) => {
    const user = makeTestUser('sp-junior')
    // Defensive: the flow is expected to reject before any account is
    // created, but tracking costs nothing if it turns out one was —
    // Cleanup silently no-ops for an email that was never registered.
    cleanup.trackUser(user.email)
    await page.goto('/signup')
    await page.locator('#first-name').fill(user.firstName)
    await page.locator('#last-name').fill(user.lastName)
    await page.locator('#email').fill(user.email)
    await page.locator('#password').fill(user.password)
    await page.locator('#confirm-password').fill(user.password)
    await page.locator('#terms').check()
    await page.locator('#years-experience').fill('3')
    await page.getByRole('button', { name: 'Request access' }).click()

    await waitForURLResilient(page, /error=/, () =>
      page.getByRole('button', { name: 'Request access' }).click()
    )
    await expect(page).toHaveURL(/error=/)
    // The signup form's static hint copy also contains "12+ years", so a
    // plain text match hits that in addition to the actual error banner —
    // scope to the banner specifically (the only element with this red
    // error styling).
    await expect(page.locator('.bg-red-50.text-red-700')).toContainText('12+ years')
  })
})
