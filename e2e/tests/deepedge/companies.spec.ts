import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

test.describe('Company directory', () => {
  test('a new employer\'s company appears in the public directory with their job listed', async ({ page, cleanup }) => {
    const employer = await signUpDeepEdge(page, 'employer', cleanup)
    await login(page, employer, '/employer/dashboard')

    const jobTitle = `E2E Company Directory Role ${Date.now()}`
    await page.getByRole('link', { name: 'Post Job' }).first().click()
    await page.waitForURL('/employer/post-job')
    await page.locator('#title').fill(jobTitle)
    await page.locator('#description').fill('Used to verify the company shows up with its open role.')
    await page.getByRole('button', { name: 'Publish Job' }).click()
    await page.waitForURL('/employer/dashboard')

    const companyName = `${employer.firstName} ${employer.lastName}'s Company`

    // Every "employer" test run produces an identically-named company
    // (firstName/lastName come from a fixed prefix, not per-run unique
    // data), so after many runs there are several matches — the companies
    // list is newest-first, so .first() is ours.
    await page.goto('/companies')
    await expect(page.getByText(companyName).first()).toBeVisible()

    await page.getByText(companyName).first().click()
    await page.waitForURL(/\/companies\//)
    await expect(page.getByRole('heading', { name: companyName })).toBeVisible()
    await expect(page.getByText(jobTitle)).toBeVisible()
  })
})
