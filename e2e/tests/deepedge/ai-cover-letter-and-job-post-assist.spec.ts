import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, getUserIdByEmail, grantActiveSubscriptionTier, setCandidateProfile } from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

/**
 * Phase A of the "11 new AI enhancements" plan (2026-09-07): A1 (cover
 * letter drafting) and A2 (job-post drafting assist), both the same
 * "assist" pattern as FlexPro's pre-existing GigQualityAssist -- free,
 * stateless, never auto-submits/auto-fills without a click, never blocks
 * the real action. Both asserted for mechanism (a real suggestion
 * appears and flows into the real submitted data), not for the specific
 * wording, since it's real non-deterministic LLM output.
 */
test('AI job-post assist gives real suggestions, and an AI-drafted cover letter can be edited and submitted', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')
  await dismissGuidedTourIfShown(employerPage)

  const jobTitle = `E2E AI Assist Job ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('We need someone to own our Kubernetes platform and CI/CD pipeline.')

  // A2: job-post assist -- a real suggestion appears, form fields are
  // untouched (informational only, no auto-fill).
  await employerPage.getByRole('button', { name: 'Get AI suggestions' }).click()
  const suggestionsBlock = employerPage.locator('p.whitespace-pre-line')
  await expect(suggestionsBlock).toBeVisible({ timeout: 30_000 })
  await expect(suggestionsBlock).not.toHaveText('')
  await expect(employerPage.locator('#skills_required')).toHaveValue('')

  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  const jobId = await getJobIdByTitle(jobTitle)

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')
  await dismissGuidedTourIfShown(candidatePage)
  const candidateId = await getUserIdByEmail(candidate.email)
  await setCandidateProfile(candidateId, {
    current_title: 'Senior Platform Engineer',
    skills: ['Kubernetes', 'CI/CD'],
    experience_years: 10,
  })

  await candidatePage.goto(`/jobs/${jobId}/apply`)

  // A1: cover letter assist -- a real draft gets written into the
  // textarea, the candidate edits it, and the EDITED text (not a blind
  // pass-through of whatever the model wrote) is what actually submits.
  await candidatePage.getByRole('button', { name: 'Draft with AI' }).click()
  const coverLetter = candidatePage.locator('#cover_letter')
  await expect(coverLetter).not.toHaveValue('', { timeout: 30_000 })

  const editMarker = `E2E edited addition ${Date.now()}`
  const draftedText = await coverLetter.inputValue()
  await coverLetter.fill(`${draftedText}\n\n${editMarker}`)

  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)

  await employerPage.goto(`/employer/jobs/${jobId}/applications`)
  await expect(employerPage.getByText(editMarker)).toBeVisible()

  await candidateCtx.close()
  await employerCtx.close()
})
