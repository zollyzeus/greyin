import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, grantActiveSubscriptionTier } from '../../utils/admin'

/**
 * FR-EE-16 / 109_grandfather_job_post_credits.sql (2026-09-04): job_post
 * was schema-ready since 096 but never actually enforced -- job posting
 * had been completely free since launch, and company_subscriptions had
 * zero rows platform-wide despite 10 of 18 real companies already having
 * jobs live. Every company that existed before this shipped was
 * grandfathered onto a free 'basic' tier so nobody already posting got
 * locked out; a brand-new company (like every company signUpDeepEdge
 * creates here) is deliberately NOT covered by that grandfather and must
 * genuinely hold a tier to post at all, confirmed with the user before
 * building this (a real monetization decision, not a bug fix).
 *
 * Every other e2e spec that posts a job as part of its own setup (not
 * testing job-posting itself) now calls grantActiveSubscriptionTier
 * first too, for exactly this reason -- this file is the one that
 * actually tests the gate.
 */
test.describe('DeepEdge job-posting credits', () => {
  test('a brand-new employer with no subscription cannot post a job', async ({ page, cleanup }) => {
    const employer = await signUpDeepEdge(page, 'employer', cleanup)
    await login(page, employer, '/employer/dashboard')

    const jobTitle = `E2E No-Credit Role ${Date.now()}`
    await page.getByRole('link', { name: 'Post Job' }).first().click()
    await page.waitForURL('/employer/post-job')
    await page.locator('#title').fill(jobTitle)
    await page.locator('#description').fill('Should never be created -- no active subscription.')
    await page.getByRole('button', { name: 'Publish Job' }).click()

    // Redirected back to the same form with an upgrade-prompting error,
    // not to the dashboard the way a successful post would be.
    await expect(page).toHaveURL(/\/employer\/post-job\?error=/)
    await expect(page.getByText(/credits.*this month|active plan|upgrade/i)).toBeVisible()

    await page.goto('/jobs')
    await expect(page.getByText(jobTitle)).not.toBeVisible()
  })

  test("a 'basic' tier employer can post exactly their 3 monthly job credits, then the 4th is blocked", async ({ page, cleanup }) => {
    const employer = await signUpDeepEdge(page, 'employer', cleanup)
    await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
    await login(page, employer, '/employer/dashboard')

    const runId = Date.now()
    for (let i = 1; i <= 3; i++) {
      const jobTitle = `E2E Credit Role ${runId}-${i}`
      await page.getByRole('link', { name: 'Post Job' }).first().click()
      await page.waitForURL('/employer/post-job')
      await page.locator('#title').fill(jobTitle)
      await page.locator('#description').fill(`Credit-consuming post #${i} of the basic tier's 3/month allowance.`)
      await page.getByRole('button', { name: 'Publish Job' }).click()
      await page.waitForURL('/employer/dashboard')
      await expect(page.getByText(jobTitle)).toBeVisible()
    }

    // The basic tier's own seeded allowance (096) is exactly 3 -- a 4th
    // post in the same calendar month must be blocked the same way the
    // no-subscription case is, not silently allowed through.
    const fourthTitle = `E2E Credit Role ${runId}-4-should-fail`
    await page.getByRole('link', { name: 'Post Job' }).first().click()
    await page.waitForURL('/employer/post-job')
    await page.locator('#title').fill(fourthTitle)
    await page.locator('#description').fill('Should be blocked -- exceeds the basic tier\'s 3 job_post credits/month.')
    await page.getByRole('button', { name: 'Publish Job' }).click()

    await expect(page).toHaveURL(/\/employer\/post-job\?error=/)
    await page.goto('/jobs')
    await expect(page.getByText(fourthTitle)).not.toBeVisible()
  })
})
