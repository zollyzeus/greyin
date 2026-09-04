import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, getCompanyIdByUserId, createBackdatedJob, grantActiveSubscriptionTier } from '../../utils/admin'

/**
 * Full fire-on-move coverage for salary trend alerts (063), completing
 * the watch-UI-only coverage in salary-trend-watch.spec.ts now that
 * jobs.salary_disclosed is actually wired up to the post-job form
 * (previously a pre-existing gap -- UI-posted jobs never fed the
 * salary_trends view's "market" source at all).
 *
 * salary_trends buckets by DATE_TRUNC('quarter', created_at), so two
 * UI-posted batches in the same test run would land in the same
 * period and just average together, not produce a comparable
 * before/after move. A backdated batch (seeded directly, 4 months
 * back) establishes the "before" period; a real UI-posted batch
 * (today, through the now-fixed checkbox) establishes "after" --
 * together they exercise the salary_disclosed fix end to end AND the
 * alert's real fire-on-move path, not just its SQL logic in isolation.
 */
test('a real salary jump between two UI-visible periods fires a watch alert', async ({ browser, cleanup }) => {
  const role = `E2E Alert Fire Role ${Date.now()}`
  const location = 'E2E Alert Fire City'

  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')
  const employerId = await getUserIdByEmail(employer.email)
  const companyId = await getCompanyIdByUserId(employerId)

  // "Before" period: 3 backdated, low-salary jobs (k-anonymity needs >=3).
  for (let i = 0; i < 3; i++) {
    await createBackdatedJob({
      companyId,
      title: role,
      location,
      salaryMin: 100000,
      salaryMax: 110000,
      monthsAgo: 4,
    })
  }

  const watcherCtx = await browser.newContext()
  const watcherPage = await watcherCtx.newPage()
  const watcher = await signUpDeepEdge(watcherPage, 'candidate', cleanup)
  await login(watcherPage, watcher, '/dashboard')

  await watcherPage.goto(`/salary-trends?role=${encodeURIComponent(role)}&location=${encodeURIComponent(location)}`)
  await watcherPage.getByRole('button', { name: 'Watch this trend' }).click()
  await watcherPage.waitForURL(/watched=1/)

  // sweep_salary_trend_alerts (063) only *captures* a baseline on the
  // first sweep after a watch is created -- it deliberately doesn't fire
  // a notification on that first sighting (nothing to compare against
  // yet). This dashboard visit is that baseline-capture sweep, run
  // against the "before" (backdated, low-salary) period, before the
  // "after" period exists.
  await watcherPage.goto('/dashboard')

  // "After" period: 3 real, high-salary jobs posted through the UI --
  // exercises the salary_disclosed checkbox fix end to end.
  for (let i = 0; i < 3; i++) {
    await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
    await employerPage.waitForURL('/employer/post-job')
    await employerPage.locator('#title').fill(role)
    await employerPage.locator('#description').fill('Real, high-salary job used to trigger a salary trend alert.')
    await employerPage.locator('#location').fill(location)
    await employerPage.locator('#salary_min').fill('300000')
    await employerPage.locator('#salary_max').fill('320000')
    await employerPage.locator('input[name="salary_disclosed"]').check()
    await employerPage.getByRole('button', { name: 'Publish Job' }).click()
    await employerPage.waitForURL('/employer/dashboard')
  }
  await employerCtx.close()

  // Dashboard load triggers sweep_salary_trend_alerts (063).
  await watcherPage.goto('/dashboard')
  await expect(watcherPage.getByText('salary trend moved', { exact: false })).toBeVisible()
  await watcherPage.goto('/notifications')
  await expect(watcherPage.getByText(role, { exact: false })).toBeVisible()
  await expect(watcherPage.getByText('moved up', { exact: false })).toBeVisible()

  await watcherCtx.close()
})
