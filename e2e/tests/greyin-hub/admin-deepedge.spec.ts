import { test, expect } from '../../utils/fixtures'
import { signUpDeepEdge, login } from '../../utils/auth'
import { getJobIdByTitle, getUserIdByEmail, promoteToAdmin, grantActiveSubscriptionTier } from '../../utils/admin'

/**
 * Ported DeepEdge admin tab on Hub (Phase 3, pitch-readiness plan) --
 * mirrors deepedge/admin.spec.ts's own assertions against the Hub-hosted
 * copy (/admin/deepedge, api/admin/deepedge/*), proving the port has
 * real parity, not just a visual copy. Employer/job creation happens on
 * DeepEdge's own domain (that's where the real posting flow lives);
 * moderation happens on Hub's domain, since that's the tab under test.
 */
test('an admin can close a job listing from the Hub-hosted DeepEdge tab', async ({ browser, cleanup }) => {
  const employerCtx = await browser.newContext()
  const employerPage = await employerCtx.newPage()
  const employer = await signUpDeepEdge(employerPage, 'employer', cleanup, 15, 'https://deepedge.greyin.net')
  await grantActiveSubscriptionTier(await getUserIdByEmail(employer.email), 'basic')
  await login(employerPage, employer, 'https://deepedge.greyin.net/employer/dashboard', 'https://deepedge.greyin.net')

  const jobTitle = `E2E Hub-Admin DeepEdge Role ${Date.now()}`
  await employerPage.goto('https://deepedge.greyin.net/employer/post-job')
  await employerPage.locator('#title').fill(jobTitle)
  await employerPage.locator('#description').fill('Role used to exercise the Hub-hosted DeepEdge admin tab.')
  await employerPage.locator('#location').fill('Remote')
  await employerPage.getByRole('button', { name: 'Publish Job' }).click()
  await employerPage.waitForURL(/\/employer\/dashboard/)
  await employerCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpDeepEdge(adminPage, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  await adminPage.goto('/admin/deepedge')
  await expect(adminPage.getByText(jobTitle)).toBeVisible()

  const jobId = await getJobIdByTitle(jobTitle)
  await adminPage
    .locator(`input[name="job_id"][value="${jobId}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Close listing' })
    .click()
  await adminPage.waitForURL(/\/admin\/deepedge/)
  await expect(adminPage.getByText(jobTitle)).not.toBeVisible()

  await adminCtx.close()
})

test('an admin can update a user role from the Hub-hosted DeepEdge tab', async ({ browser, cleanup }) => {
  const targetCtx = await browser.newContext()
  const targetPage = await targetCtx.newPage()
  const target = await signUpDeepEdge(targetPage, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  const targetId = await getUserIdByEmail(target.email)
  await targetCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpDeepEdge(adminPage, 'candidate', cleanup, 15, 'https://deepedge.greyin.net')
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, 'https://greyin.net/dashboard', 'https://greyin.net')

  await adminPage.goto('/admin/deepedge')
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
  await adminPage.waitForURL(/\/admin\/deepedge/)
  await adminCtx.close()

  const verifyCtx = await browser.newContext()
  const verifyPage = await verifyCtx.newPage()
  await login(verifyPage, target, 'https://deepedge.greyin.net/employer/dashboard', 'https://deepedge.greyin.net')
  await verifyCtx.close()
})
