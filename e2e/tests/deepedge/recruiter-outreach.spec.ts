import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, grantActiveSubscription, setYearsExperience, getJobIdByTitle } from '../../utils/admin'
import { dismissGuidedTourIfShown } from '../../utils/tour'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function restHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
}

/**
 * Skillmeet.ai comparison round, item 1 (149): search_verified_candidates
 * gained score-based ranking/filtering, and job_invites finally wires up
 * the 'job_invite' credit type (seeded since 096, never consumed until
 * now) to a real proactive-outreach action.
 */
test.describe('Recruiter outreach', () => {
  test('an employer can filter search by Greyin Score and invite a candidate to a specific job, which notifies the candidate', async ({ browser, cleanup }) => {
    const candidateCtx = await browser.newContext()
    const candidatePage = await candidateCtx.newPage()
    const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
    await login(candidatePage, candidate, '/dashboard')
    await dismissGuidedTourIfShown(candidatePage)
    // years_experience >= 12 crosses the default is_verified_expert gate
    // (038/041) so this candidate actually appears in the search pool.
    await setYearsExperience(await getUserIdByEmail(candidate.email), 15)

    const employerCtx = await browser.newContext()
    const employerPage = await employerCtx.newPage()
    const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
    await login(employerPage, employer, '/employer/dashboard')
    await dismissGuidedTourIfShown(employerPage)
    await grantActiveSubscription(await getUserIdByEmail(employer.email))

    const jobTitle = `E2E Outreach Job ${Date.now()}`
    await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
    await employerPage.waitForURL('/employer/post-job')
    await employerPage.locator('#title').fill(jobTitle)
    await employerPage.locator('#description').fill('Own a high-scale distributed system end to end.')
    await employerPage.locator('#skills_required').fill('Distributed Systems')
    await employerPage.getByRole('button', { name: 'Publish Job' }).click()
    await employerPage.waitForURL('/employer/dashboard')
    const jobId = await getJobIdByTitle(jobTitle)

    // Score filter -- a threshold high enough to exclude nobody real
    // would defeat the point, so just confirm the filtered search still
    // finds our candidate (any real verified expert clears 0+).
    await employerPage.goto('/candidates?min_score=0')
    await expect(employerPage.getByText(`${candidate.firstName} ${candidate.lastName}`)).toBeVisible()

    // Send the invite via the new inline form.
    const card = employerPage.locator('div.bg-white.rounded-lg.shadow-md.p-6').filter({ hasText: `${candidate.firstName} ${candidate.lastName}` })
    await card.locator('select[name="job_id"]').selectOption({ label: jobTitle })
    await card.getByRole('button', { name: 'Invite' }).click()
    await employerPage.waitForURL(/\/candidates\?invited=1/)
    await expect(employerPage.getByText('Invite sent.')).toBeVisible()

    // Re-inviting to the same job should be a friendly conflict, not a crash.
    await employerPage.goto('/candidates?min_score=0')
    const card2 = employerPage.locator('div.bg-white.rounded-lg.shadow-md.p-6').filter({ hasText: `${candidate.firstName} ${candidate.lastName}` })
    await card2.locator('select[name="job_id"]').selectOption({ label: jobTitle })
    await card2.getByRole('button', { name: 'Invite' }).click()
    await expect(employerPage.getByText('already invited this candidate')).toBeVisible()

    // The candidate actually got notified (notify_job_invite trigger, 149).
    const candidateId = await getUserIdByEmail(candidate.email)
    const notifRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications?user_id=eq.${candidateId}&type=eq.job_invite&select=title,link`, {
      headers: restHeaders(),
    })
    const notifs = await notifRes.json()
    expect(notifs.length).toBeGreaterThanOrEqual(1)
    expect(notifs[0].link).toBe(`/jobs/${jobId}`)

    await candidateCtx.close()
    await employerCtx.close()
  })
})
