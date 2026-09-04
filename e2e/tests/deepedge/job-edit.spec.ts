import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, grantActiveSubscriptionTier, getUserIdByEmail } from '../../utils/admin'

test('an employer can edit a job and the change reflects on the public listing and their own dashboard', async ({ page, cleanup }) => {
  const employer = await signUpDeepEdge(page, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(page, employer, '/employer/dashboard')

  const originalTitle = `E2E Job Edit Original ${Date.now()}`
  await page.getByRole('link', { name: 'Post Job' }).first().click()
  await page.waitForURL('/employer/post-job')
  await page.locator('#title').fill(originalTitle)
  await page.locator('#description').fill('A role created to exercise the edit flow.')
  await page.locator('#location').fill('Remote')
  await page.getByRole('button', { name: 'Publish Job' }).click()
  await page.waitForURL('/employer/dashboard')

  const jobId = await getJobIdByTitle(originalTitle)

  const updatedTitle = `E2E Job Edit Updated ${Date.now()}`
  await page.goto(`/employer/jobs/${jobId}/edit`)
  await expect(page.locator('#title')).toHaveValue(originalTitle)
  await page.locator('#title').fill(updatedTitle)
  await page.locator('#salary_min').fill('120000')
  await page.locator('#salary_max').fill('150000')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await page.waitForURL('/employer/dashboard')

  await expect(page.getByText(updatedTitle)).toBeVisible()
  await expect(page.getByText(originalTitle)).not.toBeVisible()

  await page.goto(`/jobs/${jobId}`)
  await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible()
  await expect(page.getByText('$120k - $150k per year')).toBeVisible()
})
