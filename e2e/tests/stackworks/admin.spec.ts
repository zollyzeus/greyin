import { test, expect } from '../../utils/fixtures'
import { signUpStackWorksBuilder, login } from '../../utils/auth'
import { getUserIdByEmail, promoteToAdmin } from '../../utils/admin'

test('an admin can delete a project and an ask', async ({ browser, cleanup }) => {
  const builderCtx = await browser.newContext()
  const builderPage = await builderCtx.newPage()
  const builder = await signUpStackWorksBuilder(builderPage, cleanup)
  await login(builderPage, builder, '/dashboard')

  const title = `E2E Admin Moderation Project ${Date.now()}`
  await builderPage.goto('/projects/new')
  await builderPage.locator('#title').fill(title)
  await builderPage.locator('#description').fill('Created to exercise admin moderation.')
  await builderPage.getByRole('button', { name: 'Post Project' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+$/)
  const projectId = builderPage.url().split('/projects/')[1]

  await builderPage.getByRole('link', { name: 'Post an ask' }).click()
  await builderPage.waitForURL(/\/projects\/[^/]+\/asks\/new/)
  await builderPage.locator('#role_title').fill('E2E Moderation Ask')
  await builderPage.getByRole('button', { name: 'Post Ask' }).click()
  await builderPage.waitForURL(/\/asks\/[^/]+$/)
  const askId = builderPage.url().split('/asks/')[1]
  await builderCtx.close()

  const adminCtx = await browser.newContext()
  const adminPage = await adminCtx.newPage()
  const admin = await signUpStackWorksBuilder(adminPage, cleanup)
  const adminId = await getUserIdByEmail(admin.email)
  await promoteToAdmin(adminId)
  await login(adminPage, admin, '/dashboard')

  await adminPage.goto('/admin')
  await expect(adminPage.getByText(title)).toBeVisible()
  await expect(adminPage.getByText('E2E Moderation Ask')).toBeVisible()

  adminPage.once('dialog', (d) => d.accept())
  await adminPage
    .locator(`input[name="ask_id"][value="${askId}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Delete' })
    .click()
  await adminPage.waitForURL('/admin')
  await expect(adminPage.getByText('E2E Moderation Ask')).not.toBeVisible()

  adminPage.once('dialog', (d) => d.accept())
  await adminPage
    .locator(`input[name="project_id"][value="${projectId}"]`)
    .locator('xpath=..')
    .getByRole('button', { name: 'Delete' })
    .click()
  await adminPage.waitForURL('/admin')
  await expect(adminPage.getByText(title)).not.toBeVisible()

  await adminPage.goto('/projects')
  await expect(adminPage.getByText(title)).not.toBeVisible()

  await adminCtx.close()
})
