import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, getUserIdByEmail, grantActiveSubscription, grantActiveSubscriptionTier } from '../../utils/admin'

test.describe('Pivoter track', () => {
  test('a Verified Expert who tags themselves a pivoter can apply to a career-changer job and is excluded from the general candidate pool', async ({ browser, cleanup }) => {
    const employerCtx = await browser.newContext()
    const employerPage = await employerCtx.newPage()
    const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
    await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
    await login(employerPage, employer, '/employer/dashboard')
    const employerId = await getUserIdByEmail(employer.email)
    await grantActiveSubscription(employerId)

    const jobTitle = `E2E Career Changer Role ${Date.now()}`
    await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
    await employerPage.waitForURL('/employer/post-job')
    await employerPage.locator('#title').fill(jobTitle)
    await employerPage.locator('#description').fill('Role used to exercise the pivoter track.')
    await employerPage.locator('#open_to_career_changers').check()
    await employerPage.getByRole('button', { name: 'Publish Job' }).click()
    await employerPage.waitForURL('/employer/dashboard')
    const jobId = await getJobIdByTitle(jobTitle)

    // A Verified Expert (default years=15) sets the pivot tag.
    const pivoterCtx = await browser.newContext()
    const pivoterPage = await pivoterCtx.newPage()
    const pivoter = await signUpDeepEdge(pivoterPage, 'candidate', cleanup)
    await login(pivoterPage, pivoter, '/dashboard')

    await pivoterPage.goto('/profile')
    await pivoterPage.locator('input[name="is_pivoter"]').check()
    await pivoterPage.locator('input[name="pivot_from_domain"]').fill('Finance')
    await pivoterPage.locator('input[name="pivot_to_domain"]').fill('Software Engineering')
    await pivoterPage.locator('textarea[name="pivot_note"]').fill('Ready for the jump.')
    await pivoterPage.getByRole('button', { name: 'Save Pivot Status' }).click()
    await pivoterPage.waitForURL(/\?success=1/)

    await pivoterPage.goto(`/jobs/${jobId}/apply`)
    await pivoterPage.locator('#cover_letter').fill('Pivoting in, excited about this one.')
    await pivoterPage.getByRole('button', { name: 'Submit Application' }).click()
    await pivoterPage.waitForURL(/\/dashboard\/applications/)
    await expect(pivoterPage.getByText('Application submitted')).toBeVisible()

    // Excluded from the general Verified Expert search.
    await employerPage.goto('/candidates')
    await expect(employerPage.getByText(`${pivoter.firstName} ${pivoter.lastName}`)).not.toBeVisible()

    // But visible, with the Career Changer badge, on this job's applications.
    await employerPage.goto(`/employer/jobs/${jobId}/applications`)
    await expect(employerPage.getByText('Career Changer: Finance → Software Engineering')).toBeVisible()

    await employerCtx.close()
    await pivoterCtx.close()
  })

  test('a non-Verified-Expert cannot set the pivot tag', async ({ page, cleanup }) => {
    const candidate = await signUpDeepEdge(page, 'candidate', cleanup, 3)
    await login(page, candidate, '/dashboard')

    await page.goto('/profile')
    await expect(page.getByText('Verified Expert status is required to tag yourself as a career pivoter')).toBeVisible()
    await expect(page.locator('input[name="is_pivoter"]')).toHaveCount(0)
  })
})
