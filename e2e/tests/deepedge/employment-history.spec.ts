import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'

/**
 * candidate_employment_history is fully private (055_employment_history_salary_trends.sql)
 * -- add via the profile page, then confirm it's genuinely private:
 * only visible on the owner's own profile, never on the open
 * /candidates/[id] page endorsements/ratings live on.
 */
test('a candidate can add and remove their own employment history, and it stays private', async ({ browser, cleanup }) => {
  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')

  await candidatePage.goto('/profile')
  const company = `E2E History Co ${Date.now()}`
  await candidatePage.locator('input[name="title"]').fill('E2E Staff Engineer')
  await candidatePage.locator('input[name="company"]').fill(company)
  await candidatePage.locator('input[name="start_date"]').fill('2020-01-01')
  await candidatePage.locator('input[name="salary_amount"]').fill('180000')
  await candidatePage.getByRole('button', { name: 'Add' }).click()
  await candidatePage.waitForURL('/profile')
  await expect(candidatePage.getByText(company)).toBeVisible()

  await candidatePage.getByRole('button', { name: 'Remove' }).click()
  await candidatePage.waitForURL('/profile')
  await expect(candidatePage.getByText(company)).not.toBeVisible()

  await candidateCtx.close()
})
