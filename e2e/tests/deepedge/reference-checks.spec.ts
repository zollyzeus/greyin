import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, getJobIdByTitle, createTestGig, createCompletedOrder, grantActiveSubscriptionTier } from '../../utils/admin'

/**
 * Employer-initiated private reference checks (065/066_reference_checks*.sql).
 * Deliberately NOT gated to a real collaboration, unlike endorsements/
 * recommendations -- covers both a reference with no in-platform tie (the
 * common case: an ex-colleague from outside Greyin) and one with a real
 * FlexPro order behind it, confirming the "Greyin-verified" badge only
 * shows for the latter. The core structural guarantee under test: the
 * response goes straight to the requesting employer and is never visible
 * to the candidate, no matter where they look.
 */
test('a candidate can list references, an employer can request one tied to a real application, and only the employer sees the response', async ({ browser, cleanup }) => {
  const refereeCtx = await browser.newContext()
  const refereePage = await refereeCtx.newPage()
  const referee = await signUpDeepEdge(refereePage, 'candidate', cleanup)
  await login(refereePage, referee, '/dashboard')
  const refereeId = await getUserIdByEmail(referee.email)
  await refereeCtx.close()

  const verifiedRefereeCtx = await browser.newContext()
  const verifiedRefereePage = await verifiedRefereeCtx.newPage()
  const verifiedReferee = await signUpDeepEdge(verifiedRefereePage, 'candidate', cleanup)
  await login(verifiedRefereePage, verifiedReferee, '/dashboard')
  const verifiedRefereeId = await getUserIdByEmail(verifiedReferee.email)
  await verifiedRefereeCtx.close()

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')
  const candidateId = await getUserIdByEmail(candidate.email)

  // A real completed FlexPro order between candidate and verifiedReferee
  // -- this is what the "Greyin-verified" badge (066's trigger) picks up.
  const gig = await createTestGig(candidateId)
  await createCompletedOrder({ gigId: gig.id, buyerId: verifiedRefereeId, sellerId: candidateId, amount: 1800 })

  // Reference #1: no in-platform tie, just an ex-colleague claim -- the
  // common real-world case a collaborators-gate would have wrongly blocked.
  await candidatePage.goto(`/candidates/${refereeId}`)
  await candidatePage.locator('select[name="relationship_type"]').selectOption('ex_colleague')
  await candidatePage.locator('textarea[name="relationship_detail"]').fill('We worked together at a previous company for 2 years.')
  await candidatePage.getByRole('button', { name: 'Add as reference' }).click()
  await candidatePage.waitForURL(/\/candidates\//)
  await expect(candidatePage.getByText('already added', { exact: false })).toBeVisible()

  // Reference #2: the verified one.
  await candidatePage.goto(`/candidates/${verifiedRefereeId}`)
  await candidatePage.locator('select[name="relationship_type"]').selectOption('in_platform_task')
  await candidatePage.locator('textarea[name="relationship_detail"]').fill('Delivered a gig together on FlexPro.')
  await candidatePage.getByRole('button', { name: 'Add as reference' }).click()
  await candidatePage.waitForURL(/\/candidates\//)

  // Both references belong to the candidate, not to the referees' own
  // profiles -- the verified badge (066's trigger) shows on the
  // candidate's own reference-management view: present for the FlexPro
  // tie, absent for the plain ex-colleague claim.
  await candidatePage.goto('/profile')
  const exColleagueRow = candidatePage.locator('div', { hasText: 'Former colleague' }).last()
  await expect(exColleagueRow.getByText('Greyin-verified', { exact: false })).not.toBeVisible()
  const verifiedRow = candidatePage.locator('div', { hasText: 'Worked together on a Greyin project/gig' }).last()
  await expect(verifiedRow.getByText('Greyin-verified: worked together via FlexPro', { exact: false })).toBeVisible()

  // Employer posts a job, candidate applies -- this real application is
  // what makes the employer eligible to see/request references at all.
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `E2E Reference Check Role ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise the employer-initiated reference-check flow.')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)

  await candidatePage.goto(`/jobs/${jobId}/apply`)
  await candidatePage.locator('#cover_letter').fill('Applying so a reference check can be requested.')
  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)
  await candidateCtx.close()

  // Before the application existed, a stranger-employer (no company at
  // all here, but same idea) would see no reference list -- RLS-gated,
  // not just UI-hidden. Now, with the real application in place, this
  // employer sees the ex-colleague reference and can request a check.
  await employerPage.goto(`/candidates/${candidateId}`)
  await expect(employerPage.getByText('We worked together at a previous company', { exact: false })).toBeVisible()
  await employerPage.getByRole('button', { name: 'Request a reference check' }).first().click()
  await employerPage.waitForURL(/\/candidates\//)
  await expect(employerPage.getByText('Request sent', { exact: false })).toBeVisible()

  // The referee answers -- on their own /references/respond, never
  // anywhere the candidate can reach.
  const refereeCtx2 = await browser.newContext()
  const refereePage2 = await refereeCtx2.newPage()
  await login(refereePage2, referee, '/dashboard')
  await refereePage2.goto('/references/respond')
  await expect(refereePage2.getByText(employer.lastName, { exact: false })).toBeVisible()
  const responseText = `E2E reference response ${Date.now()} -- reliable and easy to work with.`
  await refereePage2.locator('textarea[name="body"]').fill(responseText)
  await refereePage2.getByRole('button', { name: 'Submit response' }).click()
  await refereePage2.waitForURL(/\/references\/respond/)
  await expect(refereePage2.getByText('Response submitted.')).toBeVisible()
  await refereeCtx2.close()

  // The requesting employer now sees the response inline.
  await employerPage.goto(`/candidates/${candidateId}`)
  await expect(employerPage.getByText(responseText)).toBeVisible()
  await employerCtx.close()

  // The candidate never sees it -- not on their own profile, not
  // anywhere. Their reference-management view only ever shows what they
  // themselves entered (relationship/detail), never a request or response.
  const candidateCtx2 = await browser.newContext()
  const candidatePage2 = await candidateCtx2.newPage()
  await login(candidatePage2, candidate, '/dashboard')
  await candidatePage2.goto('/profile')
  await expect(candidatePage2.getByText(responseText)).not.toBeVisible()
  await expect(candidatePage2.getByText('Request sent', { exact: false })).not.toBeVisible()
  await candidateCtx2.close()
})
