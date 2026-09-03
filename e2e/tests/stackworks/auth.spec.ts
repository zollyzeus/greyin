import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, signUpStackWorksSupporter, login } from '../../utils/auth'
import { makeTestUser } from '../../utils/testUser'
import { waitForURLResilient } from '../../utils/nav'

test.describe('StackWorks auth and the two tracks', () => {
  test('a Builder with 12+ years of experience can sign up and log in', async ({ page, cleanup }) => {
    const user = await signUpStackWorksBuilder(page, cleanup)
    await login(page, user, '/dashboard')
    await expect(page.getByText(`Welcome, ${user.firstName} ${user.lastName}`)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Post a Project' })).toBeVisible()
  })

  test('a Supporter can sign up with no experience gate', async ({ page, cleanup }) => {
    const user = await signUpStackWorksSupporter(page, cleanup)
    await login(page, user, '/dashboard')
    await expect(page.getByText(`Welcome, ${user.firstName} ${user.lastName}`)).toBeVisible()
    // Supporters don't get the Builder-only "Post a Project" card.
    await expect(page.getByRole('link', { name: 'Post a Project' })).toHaveCount(0)
  })

  test('signup on the Builder track is rejected for under 12 years of experience', async ({ page, cleanup }) => {
    const user = makeTestUser('pl-junior')
    // Defensive: the flow is expected to reject before any account is
    // created, but tracking costs nothing if it turns out one was --
    // Cleanup silently no-ops for an email that was never registered.
    cleanup.trackUser(user.email)
    await page.goto('/signup')
    await page.locator('#first-name').fill(user.firstName)
    await page.locator('#last-name').fill(user.lastName)
    await page.locator('#email').fill(user.email)
    await page.locator('#password').fill(user.password)
    await page.locator('#confirm-password').fill(user.password)
    await page.locator('#terms').check()
    await page.locator('input[type="radio"][name="track"][value="builder"]').check({ force: true })
    await page.locator('#years-experience').fill('3')
    await page.getByRole('button', { name: 'Create account' }).click()

    await waitForURLResilient(page, /error=/, () =>
      page.getByRole('button', { name: 'Create account' }).click()
    )
    await expect(page).toHaveURL(/error=/)
    await expect(page.locator('.bg-red-50.text-red-700')).toContainText('12+ years')
  })
})
