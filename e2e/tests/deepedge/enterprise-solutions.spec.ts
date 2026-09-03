import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

test.describe('Enterprise solutions: fractional leadership + outplacement', () => {
  test('the /solutions page links to sales-led lead capture for both services, and admin triages them without an Activate button', async ({ browser, cleanup }) => {
    const employerCtx = await browser.newContext()
    const employerPage = await employerCtx.newPage()
    const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
    await login(employerPage, employer, '/employer/dashboard')

    await employerPage.goto('/solutions')
    await expect(employerPage.getByRole('heading', { name: 'Age-Blind Candidate Search' })).toBeVisible()
    await expect(employerPage.getByRole('heading', { name: 'Fractional Leadership Placement' })).toBeVisible()
    await expect(employerPage.getByRole('heading', { name: 'Outplacement' })).toBeVisible()

    // Outplacement lead, pre-selected from the query param.
    const companyName = `E2E Outplacement Co ${Date.now()}`
    await employerPage.goto('/enterprise-contact?service=outplacement')
    await expect(employerPage.getByRole('heading', { name: 'Outplacement' })).toBeVisible()
    await expect(employerPage.locator('#service_type')).toHaveValue('outplacement')
    await employerPage.locator('#company_name').fill(companyName)
    await employerPage.locator('#contact_name').fill(`${employer.firstName} ${employer.lastName}`)
    await employerPage.locator('#contact_email').fill(employer.email)
    await employerPage.getByRole('button', { name: 'Request a callback' }).click()
    await employerPage.waitForURL(/\/enterprise-contact\?success=1/)
    await employerCtx.close()

    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()
    const admin = await signUpDeepEdge(adminPage, 'candidate', cleanup)
    const adminId = await getUserIdByEmail(admin.email)
    await promoteToAdmin(adminId)
    await login(adminPage, admin, '/dashboard')

    await adminPage.goto('/admin/subscriptions')
    const leadRow = adminPage.locator('div.items-start.justify-between', { hasText: companyName })
    // Exact match -- the company name itself contains "Outplacement" as a
    // substring, which would otherwise also match the badge assertion.
    await expect(leadRow.getByText('Outplacement', { exact: true })).toBeVisible()
    await expect(leadRow.getByRole('button', { name: 'Activate' })).toHaveCount(0)
    await leadRow.getByRole('button', { name: 'Mark Contacted' }).click()
    await adminPage.waitForURL(/\/admin\/subscriptions\?success=contacted/)
    await expect(adminPage.getByText('Lead marked as contacted.')).toBeVisible()

    await adminCtx.close()
  })
})
