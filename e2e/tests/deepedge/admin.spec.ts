import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, getUserIdByEmail, promoteToAdmin, grantActiveSubscriptionTier } from '../../utils/admin'

test('an admin can close a job listing', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup)
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, '/employer/dashboard')

  const jobTitle = `E2E Admin Moderation Role ${Date.now()}`
  await employerPage.getByRole('link', { name: 'Post Job' }).first().click()
  await employerPage.waitForURL('/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise admin moderation.')
  await employerPage.locator('#location').fill('Remote')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL('/employer/dashboard')
  await employerCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpDeepEdge(adminPage, 'candidate', cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, '/dashboard')

  await adminPage.goto('/admin')
  await expect(adminPage.getByText(jobTitle)).toBeVisible()

  const jobId = await getJobIdByTitle(jobTitle)
  await adminPage
    .locator(`input[name="job_id"][value="${jobId}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Close listing' })
    .click()
  await adminPage.waitForURL('/admin')

  await expect(adminPage.getByText(jobTitle)).not.toBeVisible()

  await adminPage.goto('/jobs')
  await expect(adminPage.getByText(jobTitle)).not.toBeVisible()

  await adminCtx.close()
})

test('an admin can promote a candidate to employer and it takes effect on login', async ({ browser, cleanup }) => {
  const targetCtx = await browser.newContext()
  const targetPage = await targetCtx.newPage()
  const target = await signUpDeepEdge(targetPage, 'candidate', cleanup)
  const targetId = await getUserIdByEmail(target.email)
  await targetCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpDeepEdge(adminPage, 'candidate', cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, '/dashboard')

  await adminPage.goto('/admin')
  await adminPage
    .locator(`input[name="user_id"][value="${targetId}"]`)
    .locator('xpath=..')
    .locator('select[name="role"]')
    .selectOption('employer')
  await adminPage
    .locator(`input[name="user_id"][value="${targetId}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Update' })
    .click()
  await adminPage.waitForURL('/admin')
  await adminCtx.close()

  // Confirm the role change is real, not just a cosmetic dropdown state —
  // candidates land on /dashboard, employers get bounced to
  // /employer/dashboard, so this only passes if the role actually changed.
  const verifyCtx = await browser.newContext()
  const verifyPage = await verifyCtx.newPage()
  await login(verifyPage, target, '/employer/dashboard')
  await verifyCtx.close()
})
