import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle } from '../../utils/admin'

test.describe('Job posting and application lifecycle', () => {
  test('employer posts a job and it appears in the public listing', async ({ page, cleanup }) => {
    const employer = await signUpDeepEdge(page, 'employer', cleanup)
    await login(page, employer, '/employer/dashboard')

    const jobTitle = `E2E Staff Engineer ${Date.now()}`
    await page.getByRole('link', { name: 'Post Job' }).first().click()
    await page.waitForURL('/employer/post-job')
    await page.locator('#title').fill(jobTitle)
    await page.locator('#description').fill('A role created by the Playwright e2e suite.')
    await page.locator('#location').fill('Remote')
    await page.getByRole('button', { name: 'Publish Job' }).click()
    await page.waitForURL('/employer/dashboard')

    await expect(page.getByText(jobTitle)).toBeVisible()

    await page.goto('/jobs')
    await expect(page.getByText(jobTitle)).toBeVisible()
  })

  test('candidate applies, employer reviews and updates status, candidate sees the update', async ({ browser, cleanup }) => {
    const employerCtx = await browser.newContext()
    const employerPage = await employerCtx.newPage()
    const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
    await login(employerPage, employer, '/employer/dashboard')

    const jobTitle = `E2E Applications Test Role ${Date.now()}`
    await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
    await employerPage.waitForURL('/employer/post-job')
    await employerPage.locator('#title').fill(jobTitle)
    await employerPage.locator('#description').fill('Role used to exercise the application flow end to end.')
    await employerPage.getByRole('button', { name: 'Publish Job' }).click()
    await employerPage.waitForURL('/employer/dashboard')

    // Looked up directly rather than clicking through the dashboard listing
    // and waiting on that navigation — the id is deterministic and this
    // avoids depending on a browser navigation neither assertion below cares
    // about for its own sake.
    const jobId = await getJobIdByTitle(jobTitle)

    // Candidate applies in a separate, isolated browser context.
    const candidateCtx = await browser.newContext()
    const candidatePage = await candidateCtx.newPage()
    const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
    await login(candidatePage, candidate, '/dashboard')

    await candidatePage.goto(`/jobs/${jobId}/apply`)
    await candidatePage.locator('#cover_letter').fill('I am an automated test candidate, but a great one.')
    await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
    await candidatePage.waitForURL(/\/dashboard\/applications/)
    await expect(candidatePage.getByText(jobTitle)).toBeVisible()
    // Matches both the "Application submitted" banner and the status badge
    // that just says "submitted" — be specific about which one.
    await expect(candidatePage.getByText('Application submitted')).toBeVisible()

    // Employer reviews the application and moves it to "shortlisted".
    await employerPage.goto(`/employer/jobs/${jobId}/applications`)
    await expect(employerPage.getByText('I am an automated test candidate')).toBeVisible()
    await employerPage.locator('select[name="status"]').selectOption('shortlisted')
    await employerPage.getByRole('button', { name: 'Update' }).click()
    // The status-update route redirects with a ?success=1 query string --
    // an unanchored /\/applications$/ never matches it, so this always
    // ran out the full 60s timeout despite the update genuinely succeeding.
    await employerPage.waitForURL(/\/applications\?success=1/)

    // Candidate should now see the updated status.
    await candidatePage.goto('/dashboard/applications')
    await expect(candidatePage.getByText('shortlisted', { exact: false })).toBeVisible()

    await employerCtx.close()
    await candidateCtx.close()
  })
})
