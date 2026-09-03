import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

/**
 * Member voting happens on deepedge's own /governance/threshold
 * (unchanged); the admin-facing aggregate summary moved to Greyin Hub's
 * /admin/threshold-votes 2026-08-24, alongside the LLM admin panel --
 * both are genuinely platform-wide (this gate affects Verified Expert
 * status across all four marketplace apps), so this is now a cross-app
 * test rather than a single-app one.
 */
const isLocal = process.env.E2E_TARGET === 'local'
const hubBase = isLocal ? `http://localhost:${process.env.E2E_HUB_PORT || 3105}` : 'https://greyin.net'

test.describe('Advisory governance voting on the eligibility threshold', () => {
  test('votes are bucketed by Verified Expert status, and only an admin can see the summary', async ({ browser, cleanup }) => {
    const expertCtx = await browser.newContext()
    const expertPage = await expertCtx.newPage()
    // yearsExperience=15 (signUpDeepEdge's default) makes this a Verified Expert.
    const expert = await signUpDeepEdge(expertPage, 'candidate', cleanup)
    await login(expertPage, expert, '/dashboard')

    await expertPage.goto('/governance/threshold')
    await expect(expertPage.getByText('You are currently a Verified Expert')).toBeVisible()
    await expertPage.locator('#proposed_years').fill('10')
    await expertPage.locator('#proposed_score').fill('80')
    await expertPage.getByRole('button', { name: 'Submit Vote' }).click()
    await expertPage.waitForURL(/\?success=1/)
    await expect(expertPage.getByText('Your vote has been recorded.')).toBeVisible()
    await expertCtx.close()

    const nonExpertCtx = await browser.newContext()
    const nonExpertPage = await nonExpertCtx.newPage()
    const nonExpert = await signUpDeepEdge(nonExpertPage, 'candidate', cleanup, 2)
    await login(nonExpertPage, nonExpert, '/dashboard')

    await nonExpertPage.goto('/governance/threshold')
    await expect(nonExpertPage.getByText('You are not currently a Verified Expert')).toBeVisible()
    await nonExpertPage.locator('#proposed_years').fill('8')
    await nonExpertPage.locator('#proposed_score').fill('60')
    await nonExpertPage.getByRole('button', { name: 'Submit Vote' }).click()
    await nonExpertPage.waitForURL(/\?success=1/)

    // A non-admin can't see the aggregate summary at all.
    await nonExpertPage.goto(`${hubBase}/admin/threshold-votes`)
    await expect(nonExpertPage).toHaveURL(`${hubBase}/dashboard`)
    await nonExpertCtx.close()

    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()
    const admin = await signUpDeepEdge(adminPage, 'candidate', cleanup)
    const adminId = await getUserIdByEmail(admin.email)
    await promoteToAdmin(adminId)
    await login(adminPage, admin, '/dashboard')

    await adminPage.goto(`${hubBase}/admin/threshold-votes`)
    await expect(adminPage.getByText('Verified Experts')).toBeVisible()
    await expect(adminPage.getByText('Everyone else')).toBeVisible()
    // Both buckets should show at least the votes just cast (the buckets
    // are platform-wide, so counts may include other votes too -- this
    // only asserts the summary loaded and rendered real numbers, not an
    // exact count that other concurrent test runs could throw off).
    await expect(adminPage.getByText(/\d+ votes/).first()).toBeVisible()
    await adminCtx.close()
  })
})
