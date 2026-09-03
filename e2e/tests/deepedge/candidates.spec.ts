import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, grantActiveSubscription } from '../../utils/admin'

test.describe('Candidate search', () => {
  test('a new candidate is discoverable by a subscribed employer, but candidates cannot access the search themselves', async ({ browser, cleanup }) => {
    const candidateCtx = await browser.newContext()
    const candidatePage = await candidateCtx.newPage()
    const candidate = await signUpDeepEdge(candidatePage, 'candidate', cleanup)
    await login(candidatePage, candidate, '/dashboard')

    // Candidates are redirected away from the employer-only search page.
    await candidatePage.goto('/candidates')
    await expect(candidatePage).toHaveURL('/dashboard')

    const employerCtx = await browser.newContext()
    const employerPage = await employerCtx.newPage()
    const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
    await login(employerPage, employer, '/employer/dashboard')

    // The subscription gate (see subscription-gate.spec.ts for the full
    // sales-led journey) is exercised separately -- here just grant it
    // directly so this test can focus on candidate visibility.
    const employerId = await getUserIdByEmail(employer.email)
    await grantActiveSubscription(employerId)

    await employerPage.goto('/candidates')
    await expect(employerPage.getByText(`${candidate.firstName} ${candidate.lastName}`)).toBeVisible()

    await candidateCtx.close()
    await employerCtx.close()
  })
})
