import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { grantActiveSubscriptionTier, getUserIdByEmail } from '../../utils/admin'

/**
 * Covers the /jobs page's real filter form (id="job-filters", wired this
 * session) -- employment type, work location, and minimum experience are
 * each real jobs columns (employment_type, remote_type, experience_min),
 * not free text, so two jobs with deliberately different values give a
 * deterministic way to prove each checkbox/select actually narrows the
 * result set rather than just changing the URL.
 */
test('the /jobs filter form narrows results by employment type, work location, and minimum experience', async ({ page, cleanup }) => {
  const employer = await signUpDeepEdge(page, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(page, employer, '/employer/dashboard')

  const jobA = `E2E Filter Job A ${Date.now()}`
  await page.getByRole('link', { name: 'Post Job' }).first().click()
  await page.waitForURL('/employer/post-job')
  await page.locator('#title').fill(jobA)
  await page.locator('#description').fill('Contract, onsite, senior role used to exercise job filters.')
  await page.locator('#employment_type').selectOption('contract')
  await page.locator('#remote_type').selectOption('onsite')
  await page.locator('#experience_min').fill('20')
  await page.getByRole('button', { name: 'Publish Job' }).click()
  await page.waitForURL('/employer/dashboard')

  const jobB = `E2E Filter Job B ${Date.now()}`
  await page.getByRole('link', { name: 'Post Job' }).first().click()
  await page.waitForURL('/employer/post-job')
  await page.locator('#title').fill(jobB)
  await page.locator('#description').fill('Full-time, remote, entry-level role used to exercise job filters.')
  await page.locator('#employment_type').selectOption('full-time')
  await page.locator('#remote_type').selectOption('remote')
  await page.locator('#experience_min').fill('1')
  await page.getByRole('button', { name: 'Publish Job' }).click()
  await page.waitForURL('/employer/dashboard')

  // Employment type
  await page.goto('/jobs')
  await page.locator('input[name="employment_type"][value="contract"]').check()
  await page.getByRole('button', { name: 'Apply Filters' }).click()
  await page.waitForURL(/employment_type=contract/)
  await expect(page.getByText(jobA)).toBeVisible()
  await expect(page.getByText(jobB)).not.toBeVisible()

  // Work location
  await page.goto('/jobs')
  await page.locator('input[name="remote_type"][value="remote"]').check()
  await page.getByRole('button', { name: 'Apply Filters' }).click()
  await page.waitForURL(/remote_type=remote/)
  await expect(page.getByText(jobB)).toBeVisible()
  await expect(page.getByText(jobA)).not.toBeVisible()

  // Minimum experience
  await page.goto('/jobs')
  await page.locator('select[name="min_experience"]').selectOption('15')
  await page.getByRole('button', { name: 'Apply Filters' }).click()
  await page.waitForURL(/min_experience=15/)
  await expect(page.getByText(jobA)).toBeVisible()
  await expect(page.getByText(jobB)).not.toBeVisible()
})
