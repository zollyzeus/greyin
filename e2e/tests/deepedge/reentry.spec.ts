import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, getUserIdByEmail, grantActiveSubscription, grantActiveSubscriptionTier } from '../../utils/admin'

test.describe('Career re-entry track', () => {
  test('a Verified Expert who tags a career re-entry still shows up in general candidate search and job applications, with the badge visible', async ({ browser, cleanup }) => {
    const employerCtx = await browser.newContext()
    const employerPage = await employerCtx.newPage()
    const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
    await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
    await login(employerPage, employer, '/employer/dashboard')
    const employerId = await getUserIdByEmail(employer.email)
    await grantActiveSubscription(employerId)

    const jobTitle = `E2E Re-entry Role ${Date.now()}`
    await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
    await employerPage.waitForURL('/employer/post-job')
    await employerPage.locator('#title').fill(jobTitle)
    await employerPage.locator('#description').fill('Role used to exercise the re-entry track.')
    await employerPage.getByRole('button', { name: 'Publish Job' }).click()
    await employerPage.waitForURL('/employer/dashboard')
    const jobId = await getJobIdByTitle(jobTitle)

    // A Verified Expert (default years=15) sets the re-entry tag.
    const candidateCtx = await browser.newContext()
    const candidatePage = await candidateCtx.newPage()
    const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
    await login(candidatePage, candidate, '/dashboard')

    await candidatePage.goto('/profile')
    await candidatePage.locator('input[name="is_reentry"]').check()
    await candidatePage.locator('select[name="reentry_reason"]').selectOption('caregiving')
    await candidatePage.locator('textarea[name="reentry_note"]').fill('Took two years off for caregiving, ready to get back in.')
    await candidatePage.getByRole('button', { name: 'Save Re-entry Status' }).click()
    await candidatePage.waitForURL(/\?success=1/)

    // Unlike Pivoter, this is not a gate -- a re-entry candidate applies to
    // a plain job with no special flag, same as any other Verified Expert.
    await candidatePage.goto(`/jobs/${jobId}/apply`)
    await candidatePage.locator('#cover_letter').fill('Excited to get back to it.')
    await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
    await candidatePage.waitForURL(/\/dashboard\/applications/)
    await expect(candidatePage.getByText('Application submitted')).toBeVisible()

    // Still shows up in the general Verified Expert search -- the whole
    // point of the additive design over Pivoter's exclusion.
    await employerPage.goto('/candidates')
    // Candidate cards are now a <div> wrapping a <Link> (Skillmeet.ai
    // comparison round, 149) rather than the whole card being one <a> --
    // the invite-to-job form needed to sit outside the clickable link, not
    // nested inside it. Selector updated to match the outer <div>.
    const candidateCard = employerPage.locator('div.bg-white.rounded-lg.shadow-md', { hasText: `${candidate.firstName} ${candidate.lastName}` })
    await expect(candidateCard).toBeVisible()
    await expect(candidateCard.getByText('Returning to work · caregiving')).toBeVisible()

    // And the badge shows alongside, not instead of, the Verified Expert
    // line on this job's applications review.
    await employerPage.goto(`/employer/jobs/${jobId}/applications`)
    await expect(employerPage.getByText('Verified Expert')).toBeVisible()
    await expect(employerPage.getByText(/Returning to work · caregiving — "Took two years off/)).toBeVisible()

    await employerCtx.close()
    await candidateCtx.close()
  })

  test('a non-Verified-Expert cannot set the re-entry tag', async ({ page, cleanup }) => {
    const candidate = await signUpDeepEdge(page, 'candidate', cleanup, 3)
    await login(page, candidate, '/dashboard')

    await page.goto('/profile')
    await expect(page.getByText('Verified Expert status is required to tag a career re-entry')).toBeVisible()
    await expect(page.locator('input[name="is_reentry"]')).toHaveCount(0)
  })
})
