import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, grantActiveSubscriptionTier, getUserIdByEmail } from '../../utils/admin'

test.describe('Peer Referral Bridge', () => {
  test('referring an existing member notifies them, and referring a new email succeeds too', async ({ browser, cleanup }) => {
    const employerCtx = await browser.newContext()
    const employerPage = await employerCtx.newPage()
    const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
    await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
    await login(employerPage, employer, '/employer/dashboard')

    const jobTitle = `E2E Referral Role ${Date.now()}`
    await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
    await employerPage.waitForURL('/employer/post-job')
    await employerPage.locator('#title').fill(jobTitle)
    await employerPage.locator('#description').fill('Role used to exercise the referral bridge.')
    await employerPage.getByRole('button', { name: 'Publish Job' }).click()
    await employerPage.waitForURL('/employer/dashboard')
    const jobId = await getJobIdByTitle(jobTitle)

    const referredCtx = await browser.newContext()
    const referredPage = await referredCtx.newPage()
    const referred = await signUpDeepEdge(referredPage, 'candidate', cleanup)
    await referredCtx.close()

    const referrerCtx = await browser.newContext()
    const referrerPage = await referrerCtx.newPage()
    const referrer = await signUpDeepEdge(referrerPage, 'candidate', cleanup)
    await login(referrerPage, referrer, '/dashboard')

    await referrerPage.goto(`/jobs/${jobId}`)
    await referrerPage.locator('input[name="referred_email"]').fill(referred.email)
    await referrerPage.locator('textarea[name="note"]').fill('You would crush this role.')
    await referrerPage.getByRole('button', { name: 'Send Referral' }).click()
    await referrerPage.waitForURL(/\?referred=1/)
    await expect(referrerPage.getByText("Thanks — we've let them know.")).toBeVisible()

    // Referring an email with no matching account should also succeed
    // (falls through to the invite-email path instead of erroring).
    await referrerPage.goto(`/jobs/${jobId}`)
    await referrerPage.locator('input[name="referred_email"]').fill(`no-account-${Date.now()}@example.com`)
    await referrerPage.getByRole('button', { name: 'Send Referral' }).click()
    await referrerPage.waitForURL(/\?referred=1/)
    await referrerCtx.close()

    // The existing member actually got notified.
    const verifyCtx = await browser.newContext()
    const verifyPage = await verifyCtx.newPage()
    await login(verifyPage, referred, '/dashboard')
    await verifyPage.goto('/notifications')
    await expect(verifyPage.getByText(`${referrer.firstName} ${referrer.lastName} referred you to a job`)).toBeVisible()
    await expect(verifyPage.getByText(jobTitle)).toBeVisible()
    await verifyCtx.close()

    await employerCtx.close()
  })
})
