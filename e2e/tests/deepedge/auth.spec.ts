import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

test.describe('DeepEdge auth', () => {
  test('candidate can sign up and log in, landing on the candidate dashboard', async ({ page, cleanup }) => {
    const user = await signUpDeepEdge(page, 'candidate', cleanup)
    await login(page, user, '/dashboard')
    await expect(page.getByText(`Welcome back, ${user.firstName} ${user.lastName}`)).toBeVisible()
    // .first() -- the common footer (2026-09-03) also links "Browse Jobs"
    // (it's always last in DOM order, after the page's own content), so
    // this text is no longer unique on the page.
    await expect(page.getByRole('link', { name: 'Browse Jobs' }).first()).toBeVisible()
  })

  test('employer can sign up and log in, landing on the employer dashboard', async ({ page, cleanup }) => {
    const user = await signUpDeepEdge(page, 'employer', cleanup)
    await login(page, user, '/employer/dashboard')
    await expect(page.getByRole('link', { name: 'Post Job' })).toBeVisible()
    // .first() -- same footer-duplication reasoning as above ("Browse
    // Candidates" is also a footer link).
    await expect(page.getByRole('link', { name: 'Browse Candidates' }).first()).toBeVisible()
  })

  test('wrong password shows an error and does not log in', async ({ page, cleanup }) => {
    const user = await signUpDeepEdge(page, 'candidate', cleanup)
    await page.goto('/login')
    await page.locator('#email').fill(user.email)
    await page.locator('#password').fill('WrongPassword123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/error=/)
  })
})
