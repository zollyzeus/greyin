import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, grantActiveSubscriptionTier, setCandidateProfile } from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

/**
 * AI enhancement: candidate-side job recommendations on /jobs (121,
 * lib/job-recommendations.ts) -- the mirror of the employer-side
 * AI-Verified Search/Longlist matching that already existed. Four
 * distinct angles, two genuinely AI (real, non-deterministic LLM
 * ranking -- only the section's presence and a valid pick are asserted,
 * same convention as ai-mentor-matching.spec.ts) and two deterministic
 * structured comparisons (exact-content-assertable, since they're plain
 * code logic, not a model call).
 */
test('a candidate sees profile-based, history-based, preference-matched, and top-candidate job recommendations', async ({ browser, cleanup }) => {
  test.setTimeout(150_000)
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')
  await dismissGuidedTourIfShown(employerPage)

  const suffix = Date.now()

  // jobA: designed to clearly satisfy the deterministic preferences match
  // (remote + salary overlap + full skills overlap against the candidate
  // profile seeded below).
  const jobATitle = `E2E Platform Engineering Lead ${suffix}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobATitle)
  await employerPage.locator('#description').fill('Own the platform engineering roadmap for a growing infrastructure team.')
  await employerPage.locator('#remote_type').selectOption('remote')
  await employerPage.locator('#salary_min').fill('140000')
  await employerPage.locator('#salary_max').fill('190000')
  await employerPage.locator('#experience_min').fill('5')
  await employerPage.locator('#skills_required').fill('Kubernetes, Go')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')

  // jobB: designed to clearly satisfy the deterministic top-candidate
  // check (candidate experience/skills far exceed a low bar, no
  // applicants yet).
  const jobBTitle = `E2E Engineering Director ${suffix}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobBTitle)
  await employerPage.locator('#description').fill('Lead engineering for a Series B startup building developer infrastructure.')
  await employerPage.locator('#remote_type').selectOption('remote')
  await employerPage.locator('#experience_min').fill('2')
  await employerPage.locator('#skills_required').fill('Kubernetes')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')

  // jobC: what the candidate actually applies to below, so
  // recommendJobsFromApplicationHistory() has real application history
  // to infer a pattern from.
  const jobCTitle = `E2E DevOps Team Lead ${suffix}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobCTitle)
  await employerPage.locator('#description').fill('Build and run the CI/CD and Kubernetes infrastructure for our platform team.')
  await employerPage.locator('#remote_type').selectOption('remote')
  await employerPage.locator('#skills_required').fill('Kubernetes, Go')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  await employerCtx.close()

  const candidateCtx = await browser.newContext()
  const candidatePage = await candidateCtx.newPage()
  const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
  await login(candidatePage, candidate, '/dashboard')
  await dismissGuidedTourIfShown(candidatePage)
  const candidateId = await getUserIdByEmail(candidate.email)
  await setCandidateProfile(candidateId, {
    current_title: 'Senior Platform Engineer',
    skills: ['Kubernetes', 'Go', 'Terraform'],
    experience_years: 15,
    expected_salary_min: 150000,
    expected_salary_max: 200000,
    remote_preference: 'remote',
    willing_to_relocate: false,
  })

  // Real application, via the real apply flow -- this is what
  // recommendJobsFromApplicationHistory() reads. .first(): the candidate
  // profile is already seeded, so jobC may legitimately also appear in
  // one of the recommendation sections above the plain listing -- every
  // matching link points at the same job, so which one is clicked
  // doesn't matter here.
  await candidatePage.goto('/jobs')
  await candidatePage.getByRole('link', { name: jobCTitle }).first().click()
  await candidatePage.waitForURL(/\/jobs\/[^/]+$/)
  await candidatePage.getByRole('link', { name: 'Apply Now' }).first().click()
  await candidatePage.waitForURL(/\/jobs\/[^/]+\/apply$/)
  await candidatePage.locator('#cover_letter').fill('Applying to establish application history for the AI recommendations spec.')
  await candidatePage.getByRole('button', { name: 'Submit Application' }).click()
  await candidatePage.waitForURL(/\/dashboard\/applications/)

  // This request does 2 real LLM calls server-side (Promise.all in
  // jobs/page.tsx) before responding at all -- the page arrives already
  // fully rendered, no client-side poll/reload needed, but the
  // navigation itself needs a longer budget than the default.
  await candidatePage.goto('/jobs', { timeout: 60_000 })

  // level: 2 -- each recommended job card is itself an <h3> (also ARIA
  // role "heading"), so an unscoped getByRole('heading') matches those too.
  await expect(candidatePage.getByTestId('rec-section-profile').getByRole('heading', { level: 2 })).toHaveText('Recommended based on your profile')
  await expect(candidatePage.getByTestId('rec-section-history').getByRole('heading', { level: 2 })).toHaveText("More like jobs you've applied to")

  await expect(candidatePage.getByTestId('rec-section-preferences').getByRole('link', { name: new RegExp(jobATitle) })).toBeVisible()
  await expect(candidatePage.getByTestId('rec-section-top-candidate').getByRole('link', { name: new RegExp(jobBTitle) })).toBeVisible()

  await candidateCtx.close()
})
