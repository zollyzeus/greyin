import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

test.describe('DeepEdge enterprise subscription gate', () => {
  test('an unsubscribed employer is gated from /candidates, and the sales-led enterprise path opens it', async ({ browser, cleanup }) => {
    const employerCtx = await browser.newContext()
    const employerPage = await employerCtx.newPage()
    const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
    await login(employerPage, employer, '/employer/dashboard')

    // Pricing page shows both tiers with the employer-appropriate CTAs.
    await employerPage.goto('/pricing')
    await expect(employerPage.getByRole('link', { name: 'Subscribe' })).toBeVisible()
    await expect(employerPage.getByRole('link', { name: 'Contact Sales' })).toBeVisible()

    // No active subscription yet -- /candidates shows the gate, not the search.
    await employerPage.goto('/candidates')
    await expect(employerPage.getByText('Subscribe to search the Verified Expert pool')).toBeVisible()

    // Submit an enterprise lead.
    const companyName = `E2E Test Co ${Date.now()}`
    await employerPage.goto('/enterprise-contact')
    await employerPage.locator('#company_name').fill(companyName)
    await employerPage.locator('#contact_name').fill(`${employer.firstName} ${employer.lastName}`)
    await employerPage.locator('#contact_email').fill(employer.email)
    await employerPage.getByRole('button', { name: 'Request a callback' }).click()
    await employerPage.waitForURL(/\/enterprise-contact\?success=1/)
    await expect(employerPage.getByText('Request received')).toBeVisible()
    await employerCtx.close()

    // Admin sees the lead and activates it -- no card ever involved.
    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()
    const admin = await signUpDeepEdge(adminPage, 'candidate', cleanup)
    const adminId = await getUserIdByEmail(admin.email)
    await promoteToAdmin(adminId)
    await login(adminPage, admin, '/dashboard')

    await adminPage.goto('/admin/subscriptions')
    await expect(adminPage.getByText(companyName)).toBeVisible()
    const leadRow = adminPage.locator('div.items-start.justify-between', { hasText: companyName })
    await leadRow.getByRole('button', { name: 'Activate' }).click()
    await adminPage.waitForURL(/\/admin\/subscriptions\?success=1/)
    await expect(adminPage.getByText('Subscription activated.')).toBeVisible()
    await adminCtx.close()

    // The gate is gone -- the employer can now search.
    const verifyCtx = await browser.newContext()
    const verifyPage = await verifyCtx.newPage()
    await login(verifyPage, employer, '/employer/dashboard')
    await verifyPage.goto('/candidates')
    await expect(verifyPage.getByText('Subscribe to search the Verified Expert pool')).not.toBeVisible()
    await expect(verifyPage.getByRole('heading', { name: 'Browse Candidates' })).toBeVisible()
    await verifyCtx.close()
  })
})
