import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, setCandidateProfile } from '../../utils/admin'

/**
 * salary_trends is k-anonymized -- HAVING COUNT(*) >= 3
 * (055_employment_history_salary_trends.sql). Below the floor, a role
 * shows "not enough data"; at/above it, a real chart renders. Seeds 3
 * candidates' expected_salary (the simplest of the view's three
 * sources to set up from e2e) all under one unique, unambiguous role
 * title so this test can't collide with any real production data.
 */
test('a role with fewer than 3 data points shows no chart; with 3+, a real trend renders', async ({ browser, cleanup }) => {
  const role = `E2E Salary Trend Role ${Date.now()}`

  const viewerCtx = await browser.newContext()
  const viewerPage = await viewerCtx.newPage()
  const viewer = await signUpDeepEdge(viewerPage, 'candidate', cleanup)
  await login(viewerPage, viewer, '/dashboard')

  await viewerPage.goto(`/salary-trends?role=${encodeURIComponent(role)}`)
  await expect(viewerPage.getByText('Not enough data yet for this filter')).toBeVisible()

  // Seed 3 candidates with this exact role as their current_title and a
  // real expected_salary range -- the view's "expected" source branch.
  for (let i = 0; i < 3; i++) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    const candidate = await signUpDeepEdge(page, 'candidate', cleanup)
    await login(page, candidate, '/dashboard')
    const userId = await getUserIdByEmail(candidate.email)
    await setCandidateProfile(userId, { current_title: role, expected_salary_min: 140000, expected_salary_max: 160000, experience_years: 10 })
    await ctx.close()
  }

  await viewerPage.goto(`/salary-trends?role=${encodeURIComponent(role)}`)
  await expect(viewerPage.getByText('Not enough data yet for this filter')).not.toBeVisible()
  await expect(viewerPage.locator('svg[aria-label="Average salary by source"]')).toBeVisible()
  await expect(viewerPage.getByText('n=3')).toBeVisible()

  await viewerCtx.close()
})
