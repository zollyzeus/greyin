import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, grantActiveSubscriptionTier, getUserIdByEmail } from '../../utils/admin'

/**
 * Company reviews (058_company_reviews.sql) are gated on a real
 * application at that company -- eligibility is checked server-side
 * (companies/[id]/page.tsx mirrors the RLS policy) so the form only
 * renders when it would actually succeed. Anonymous by display: the
 * reviewer's name is never queried/rendered, only the rating/text/date.
 */
test('a candidate who applied can review the company, and the review shows without their name', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `E2E Company Review Role ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise the company review eligibility gate.')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)
  await employerCtx.close()

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')

  await candidatePage.goto(`/jobs/${jobId}/apply`)
  await candidatePage.locator('#cover_letter').fill('Applying so I can leave a review afterward.')
  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)

  await candidatePage.goto(`/jobs/${jobId}`)

  const companyLink = candidatePage.locator('a[href^="/companies/"]').first()
  await companyLink.click()
  await candidatePage.waitForURL(/\/companies\//)

  const reviewText = `E2E review text ${Date.now()} -- straightforward application process.`
  await candidatePage.getByLabel('Your rating').selectOption('4')
  await candidatePage.locator('textarea[name="review_text"]').fill(reviewText)
  await candidatePage.getByRole('button', { name: 'Submit review' }).click()
  await candidatePage.waitForURL(/\/companies\//)

  await expect(candidatePage.getByText(reviewText)).toBeVisible()
  await expect(candidatePage.getByText(candidate.lastName)).not.toBeVisible()
  await expect(candidatePage.getByText('You’ve already reviewed this company.')).toBeVisible()
  const companyUrl = candidatePage.url()
  await candidateCtx.close()

  // A stranger with no application at this company never sees the review form.
  const strangerCtx = await browser.newContext()
  const strangerPage = await strangerCtx.newPage()
  const stranger = await signUpDeepEdge(strangerPage, 'candidate', cleanup)
  await login(strangerPage, stranger, '/dashboard')
  await strangerPage.goto(companyUrl)
  await expect(strangerPage.getByText(reviewText)).toBeVisible()
  await expect(strangerPage.getByLabel('Your rating')).not.toBeVisible()
  await strangerCtx.close()
})
