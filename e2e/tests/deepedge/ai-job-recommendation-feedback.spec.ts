import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, getUserIdByEmail, grantActiveSubscriptionTier, promoteToAdmin, setCandidateProfile } from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const isLocal = process.env.E2E_TARGET === 'local'
const greyinHubBase = isLocal ? `http://localhost:${process.env.E2E_GREYIN_HUB_PORT || 3107}` : 'https://greyin.net'

function restHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  }
}

/**
 * Recommendation-feedback loop, all 3 phases (125). Explicitly scoped to
 * proving the MECHANISM works end to end with test data -- write ->
 * exclude -> personalize-without-breaking -> aggregate -> admin report
 * -- not that the recommendations get objectively better, which needs
 * real user judgment no amount of seeded data can substitute for (see
 * this feature's own design discussion). Phase 1 and Phase 3 are fully
 * deterministic and exact-content-asserted; Phase 2 only asserts the
 * feedback-hint code path doesn't break the pipeline, since asserting a
 * real LLM's ranking measurably shifted would be asserting recommendation
 * *quality*, out of scope here.
 */
test('feedback loop: downvoting excludes a job, feeding 3+ negative signals does not break future ranking, and admin sees accurate aggregates', async ({ browser, cleanup }) => {
  test.setTimeout(150_000)

  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')
  await dismissGuidedTourIfShown(employerPage)

  const suffix = Date.now()

  // jobA: designed to clearly satisfy the deterministic "preferences"
  // match, same technique as ai-job-recommendations.spec.ts -- this is
  // the job Phase 1 downvotes, since it's guaranteed to show up
  // somewhere to downvote in the first place.
  const jobATitle = `E2E Feedback Preferences Job ${suffix}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobATitle)
  await employerPage.locator('#description').fill('Role used to exercise the recommendation-feedback loop.')
  await employerPage.locator('#remote_type').selectOption('remote')
  await employerPage.locator('#salary_min').fill('140000')
  await employerPage.locator('#salary_max').fill('190000')
  await employerPage.locator('#skills_required').fill('Kubernetes, Go')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')

  // 2 seed jobs, for the 2 REST-inserted negative feedback rows below
  // (combined with jobA's own UI-driven feedback, reaches Phase 2's
  // >=3 threshold) and Phase 3's aggregate assertions -- their own
  // content doesn't matter, they just need to be real job rows to
  // satisfy the FK.
  const seedJobTitles: string[] = []
  for (let i = 0; i < 2; i++) {
    const title = `E2E Feedback Seed Job ${suffix}-${i}`
    await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
    await employerPage.waitForURL('/employer/post-job')
    await employerPage.locator('#title').fill(title)
    await employerPage.locator('#description').fill('Seed job for the recommendation-feedback loop spec.')
    await employerPage.getByRole('button', { name: 'Publish Job' }).click()
    await employerPage.waitForURL('/employer/dashboard')
    seedJobTitles.push(title)
  }
  const seedJobIds = await Promise.all(seedJobTitles.map((t) => getJobIdByTitle(t)))
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
    experience_years: 12,
    expected_salary_min: 150000,
    expected_salary_max: 200000,
    remote_preference: 'remote',
    willing_to_relocate: false,
  })

  // --- Phase 1: downvote jobA via the real UI, in the preferences
  // section, and confirm both the DB row and the exclusion-on-reload.
  await candidatePage.goto('/jobs')
  const jobACard = candidatePage.getByTestId('rec-section-preferences').locator('[data-testid^="rec-card-"]', { hasText: jobATitle })
  await expect(jobACard).toBeVisible({ timeout: 30_000 })
  await jobACard.getByRole('button', { name: 'Not relevant' }).click()
  await jobACard.getByRole('button', { name: 'Not the right seniority/type' }).click()
  await expect(jobACard.getByText('you won’t see this one again', { exact: false })).toBeVisible()

  await candidatePage.reload()
  await expect(candidatePage.getByTestId('rec-section-preferences').getByText(jobATitle)).not.toBeVisible()
  // Full listing below also respects it -- excluded jobs aren't hidden
  // from ordinary browsing, only from being *recommended* again; assert
  // it's specifically gone from the recommendation section, not the page.
  await expect(candidatePage.getByText(jobATitle).first()).toBeVisible()

  const feedbackCheck = await fetch(
    `${SUPABASE_URL}/rest/v1/job_recommendation_feedback?user_id=eq.${candidateId}&select=job_id,recommendation_type,feedback`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
  )
  const feedbackRows = await feedbackCheck.json()
  expect(feedbackRows).toHaveLength(1)
  expect(feedbackRows[0].recommendation_type).toBe('preferences')
  expect(feedbackRows[0].feedback).toBe('not_relevant')

  // --- Phase 2: seed 2 more negative feedback rows directly (reaching
  // the >=3 threshold buildFeedbackHint() gates on), against the real
  // seed jobs created above, then confirm the profile-based section
  // (the one whose prompt now includes the feedback hint) still renders
  // successfully -- proving the hint-building code path doesn't break
  // the LLM call, not that it changes what gets picked.
  for (const seedJobId of seedJobIds) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/job_recommendation_feedback`, {
      method: 'POST',
      headers: restHeaders(),
      body: JSON.stringify({ user_id: candidateId, job_id: seedJobId, recommendation_type: 'profile', feedback: 'wrong_fit' }),
    })
    expect(res.ok).toBeTruthy()
  }

  await candidatePage.goto('/jobs', { timeout: 60_000 })
  await expect(candidatePage.getByTestId('rec-section-profile').getByRole('heading', { level: 2 })).toHaveText('Recommended based on your profile')

  // --- Best-effort: give one more piece of positive feedback (top-
  // candidate section) so Phase 3 also has a helpful signal to report
  // on, alongside the negative ones asserted below. Not asserted on --
  // findTopCandidateJobs() ranks partly on live applications_count
  // across the *entire* real job pool (not just this test's own jobs),
  // which genuinely shifts under full-suite concurrency as unrelated
  // specs apply to the same real jobs -- neither which job appears here
  // nor whether the click round-trip finishes in time is something this
  // test's own Phase 3 assertions (below) actually depend on.
  try {
    const topCandidateSection = candidatePage.getByTestId('rec-section-top-candidate')
    const anyCard = topCandidateSection.locator('[data-testid^="rec-card-"]').first()
    if (await anyCard.count()) {
      await anyCard.getByRole('button', { name: 'Helpful' }).click()
    }
  } catch {
    // Purely cosmetic enrichment -- see comment above.
  }
  await candidateCtx.close()

  // --- Phase 3: admin sees accurate aggregates for this candidate's
  // feedback -- 'preferences' has 1 not_relevant, 'profile' has 2
  // wrong_fit, both exact and deterministic regardless of what the LLM
  // sections actually picked.
  await promoteToAdmin(await getUserIdByEmail(employer.email))
  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  await login(adminPage, employer, 'https://deepedge.greyin.net/dashboard', 'https://deepedge.greyin.net')
  await dismissGuidedTourIfShown(adminPage)

  await adminPage.goto(`${greyinHubBase}/admin/job-recommendation-feedback`)
  await expect(adminPage.getByRole('heading', { name: 'Job Recommendation Feedback' })).toBeVisible()

  const preferencesRow = adminPage.locator('tr', { hasText: 'Matches your preferences' })
  await expect(preferencesRow).toBeVisible()
  await expect(preferencesRow.locator('td').nth(2)).toHaveText('1') // not_relevant column

  const profileRow = adminPage.locator('tr', { hasText: 'Based on your profile' })
  await expect(profileRow).toBeVisible()
  await expect(profileRow.locator('td').nth(4)).toHaveText('2') // wrong_fit column

  await adminCtx.close()
})
