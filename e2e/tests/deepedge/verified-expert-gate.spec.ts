import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, getUserIdByEmail, grantActiveSubscription } from '../../utils/admin'
import { waitForURLResilient } from '../../utils/nav'

test.describe('DeepEdge Verified Expert candidacy gate', () => {
  test('an under-12-years candidate can sign up and log in but is blocked from applying and absent from employer search, while a 12+-years candidate succeeds at both', async ({ browser, cleanup }) => {
    const employerCtx = await browser.newContext()
    const employerPage = await employerCtx.newPage()
    const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
    await login(employerPage, employer, '/employer/dashboard')

    // The employer candidate search is behind the subscription gate
    // (subscription-gate.spec.ts covers that journey) -- grant it directly
    // here so this test can focus on the candidacy eligibility gate.
    const employerId = await getUserIdByEmail(employer.email)
    await grantActiveSubscription(employerId)

    const jobTitle = `E2E Verified Expert Gate Role ${Date.now()}`
    await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
    await employerPage.waitForURL('/employer/post-job')
    await employerPage.locator('#title').fill(jobTitle)
    await employerPage.locator('#description').fill('Role used to exercise the Verified Expert candidacy gate.')
    await employerPage.getByRole('button', { name: 'Publish Job' }).click()
    await employerPage.waitForURL('/employer/dashboard')
    const jobId = await getJobIdByTitle(jobTitle)

    // Ineligible candidate: signup and login succeed (signup itself is
    // never rejected), but applying is blocked.
    const ineligibleCtx = await browser.newContext()
    const ineligiblePage = await ineligibleCtx.newPage()
    const ineligible = await signUpDeepEdge(ineligiblePage, 'candidate', cleanup, 3)
    await login(ineligiblePage, ineligible, '/dashboard')

    await ineligiblePage.goto(`/jobs/${jobId}/apply`)
    await ineligiblePage.locator('#cover_letter').fill('I should not be allowed to submit this.')
    await ineligiblePage.getByRole('button', { name: 'Submit Application' }).click()
    await waitForURLResilient(ineligiblePage, /error=/, () =>
      ineligiblePage.getByRole('button', { name: 'Submit Application' }).click()
    )
    await expect(ineligiblePage).toHaveURL(/error=/)

    // Eligible candidate: applies successfully.
    const eligibleCtx = await browser.newContext()
    const eligiblePage = await eligibleCtx.newPage()
    const eligible = await signUpDeepEdge(eligiblePage, 'candidate', cleanup, 15)
    await login(eligiblePage, eligible, '/dashboard')

    await eligiblePage.goto(`/jobs/${jobId}/apply`)
    await eligiblePage.locator('#cover_letter').fill('I am a Verified Expert and should be able to apply.')
    await eligiblePage.getByRole('button', { name: 'Submit Application' }).click()
    await eligiblePage.waitForURL(/\/dashboard\/applications/)
    await expect(eligiblePage.getByText('Application submitted')).toBeVisible()

    // Employer candidate search only ever surfaces the Verified Expert pool.
    await employerPage.goto('/candidates')
    await expect(employerPage.getByText(`${eligible.firstName} ${eligible.lastName}`)).toBeVisible()
    await expect(employerPage.getByText(`${ineligible.firstName} ${ineligible.lastName}`)).not.toBeVisible()

    await employerCtx.close()
    await ineligibleCtx.close()
    await eligibleCtx.close()
  })
})
