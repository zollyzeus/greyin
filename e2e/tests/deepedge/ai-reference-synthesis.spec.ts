import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, getJobIdByTitle, grantActiveSubscriptionTier } from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

/**
 * AI moat roadmap item: AI-synthesized reference reports (117,
 * lib/reference-synthesis.ts) -- once an employer has 2+ referee
 * responses for the same candidate, a local-model synthesis runs
 * automatically and shows a consistency-flagged summary above the raw
 * responses. Confidential to the requesting employer, same as the raw
 * responses it summarizes (see reference-checks.spec.ts for that
 * guarantee) -- not re-asserted here to keep this test focused on the
 * synthesis step itself. Score/summary text is non-deterministic (a real
 * local model), so only the pattern is asserted, not exact wording.
 */
test('two consistent reference responses trigger an AI-synthesized summary visible to the requesting employer', async ({ browser, cleanup }) => {
  const referee1Ctx = await browser.newContext()
  const referee1Page = await referee1Ctx.newPage()
  const referee1 = await signUpDeepEdge(referee1Page, 'candidate', cleanup)
  await login(referee1Page, referee1, '/dashboard')
  const referee1Id = await getUserIdByEmail(referee1.email)
  await referee1Ctx.close()

  const referee2Ctx = await browser.newContext()
  const referee2Page = await referee2Ctx.newPage()
  const referee2 = await signUpDeepEdge(referee2Page, 'candidate', cleanup)
  await login(referee2Page, referee2, '/dashboard')
  const referee2Id = await getUserIdByEmail(referee2.email)
  await referee2Ctx.close()

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')
  // Nothing burns off GuidedTour's ~600ms auto-start delay between this
  // login and the goto+click below -- see e2e/utils/tour.ts.
  await dismissGuidedTourIfShown(candidatePage)
  const candidateId = await getUserIdByEmail(candidate.email)

  await candidatePage.goto(`/candidates/${referee1Id}`)
  await candidatePage.locator('select[name="relationship_type"]').selectOption('ex_colleague')
  await candidatePage.locator('textarea[name="relationship_detail"]').fill('We worked together at a previous company for 2 years.')
  await candidatePage.getByRole('button', { name: 'Add as reference' }).click()
  await candidatePage.waitForURL(/\/candidates\//)

  await candidatePage.goto(`/candidates/${referee2Id}`)
  await candidatePage.locator('select[name="relationship_type"]').selectOption('ex_colleague')
  await candidatePage.locator('textarea[name="relationship_detail"]').fill('Reported to me on my team for a year.')
  await candidatePage.getByRole('button', { name: 'Add as reference' }).click()
  await candidatePage.waitForURL(/\/candidates\//)

  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')
  await dismissGuidedTourIfShown(employerPage)

  const jobTitle = `E2E AI Reference Synthesis Role ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise the AI reference-synthesis pipeline.')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)

  await candidatePage.goto(`/jobs/${jobId}/apply`)
  await candidatePage.locator('#cover_letter').fill('Applying so both reference checks can be requested.')
  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)
  await candidateCtx.close()

  await employerPage.goto(`/candidates/${candidateId}`)
  await employerPage.getByRole('button', { name: 'Request a reference check' }).first().click()
  await employerPage.waitForURL(/\/candidates\//)
  await employerPage.getByRole('button', { name: 'Request a reference check' }).first().click()
  await employerPage.waitForURL(/\/candidates\//)

  const referee1Ctx2 = await browser.newContext()
  const referee1Page2 = await referee1Ctx2.newPage()
  await login(referee1Page2, referee1, '/dashboard')
  await dismissGuidedTourIfShown(referee1Page2)
  await referee1Page2.goto('/references/respond')
  await referee1Page2.locator('textarea[name="body"]').fill(
    `E2E reference response ${Date.now()} -- consistently reliable, delivered every project on time, great communicator.`
  )
  await referee1Page2.getByRole('button', { name: 'Submit response' }).click()
  await referee1Page2.waitForURL(/\/references\/respond/)
  await expect(referee1Page2.getByText('Response submitted.')).toBeVisible()
  await referee1Ctx2.close()

  // Only one response so far -- synthesis needs 2, so no report yet.
  await employerPage.goto(`/candidates/${candidateId}`)
  await expect(employerPage.getByText('AI reference summary', { exact: false })).not.toBeVisible()

  const referee2Ctx2 = await browser.newContext()
  const referee2Page2 = await referee2Ctx2.newPage()
  await login(referee2Page2, referee2, '/dashboard')
  await dismissGuidedTourIfShown(referee2Page2)
  await referee2Page2.goto('/references/respond')
  await referee2Page2.locator('textarea[name="body"]').fill(
    `E2E reference response ${Date.now()} -- also very reliable, always hit deadlines, easy to work with day to day.`
  )
  await referee2Page2.getByRole('button', { name: 'Submit response' }).click()
  await referee2Page2.waitForURL(/\/references\/respond/)
  await expect(referee2Page2.getByText('Response submitted.')).toBeVisible()
  await referee2Ctx2.close()

  // Second response should trigger synthesis -- report now visible to
  // the requesting employer, above the two raw responses.
  await employerPage.goto(`/candidates/${candidateId}`)
  await expect(employerPage.getByText('AI reference summary', { exact: false })).toBeVisible({ timeout: 30_000 })
  await expect(employerPage.getByText(/Based on 2 responses\./)).toBeVisible()
  await employerCtx.close()
})
